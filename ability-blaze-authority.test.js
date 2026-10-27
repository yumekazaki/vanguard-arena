"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-blaze-own-attack-more-rearguards-v1";

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Unit", type: definition?.type || "Unit", grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function setup({ side = "bot", sourceCardId = "cfa-3844", rearCounts = [3, 1], attackCount = 1, battleId = "blaze-battle" } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const sourceCard = catalog.find(item => String(item.id) === sourceCardId);
  const ability = Engine.parseCardAbilitiesCached(sourceCard).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `catalog ability for ${sourceCardId}`);
  const sourceLocation = ability.requiredLocation.includes("rear-guard") && !ability.requiredLocation.includes("vanguard") ? "rear-guard" : "vanguard";
  const sourceCircle = sourceLocation === "vanguard" ? "vanguard" : "rear-left";
  const source = card(sourceCardId, `blaze-source-${side}`, ownerId, { zone: sourceLocation, circle: sourceCircle });
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], blazing: false });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const own = players[side], opposing = players[opponentSide];
  own.vanguard = sourceLocation === "vanguard" ? source : card("cfa-3", `own-vanguard-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  if (sourceLocation === "rear-guard") own.rear.push(source);
  while (own.rear.length < rearCounts[0]) own.rear.push(card("cfa-3", `own-rear-${side}-${own.rear.length}`, ownerId, { zone: "rear-guard", circle: `rear-${own.rear.length ? "right" : "left"}` }));
  opposing.vanguard = card("cfa-3", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  while (opposing.rear.length < rearCounts[1]) opposing.rear.push(card("cfa-3", `opponent-rear-${side}-${opposing.rear.length}`, opponentId, { zone: "rear-guard", circle: `rear-${opposing.rear.length ? "right" : "left"}` }));
  const state = { matchId: "blaze-authority", stateVersion: 1, side, phase: 3, turn: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players, pendingAttack: { battleId, attackerSide: side, attackerUid: own.vanguard.uid, attackerZone: "vanguard", defenderSide: opponentSide, targetUid: opposing.vanguard.uid, targetZone: "vanguard", power: 16000, targetPower: 10000, critical: 1, guardCards: [] } };
  const event = Engine.createGameEvent(state, {
    type: "attack.step-started", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: own.vanguard.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: own.vanguard.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    battleId, playerAttackCount: attackCount, phase: "battle", timingWindow: "attack-step"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, side, ownerId, opponentId, own, opposing, ability, source, event, discovery, attackCount };
}

function resolve(fixture, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest") {
  const pending = fixture.state.pendingAbility;
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId: `resolve-${fixture.side}-${fixture.attackCount}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: pending?.instance?.uid || fixture.source.uid, abilityId: pending?.ability?.id || fixture.ability.id } }
  }, seats, Engine);
}

test("all 27 exact Blaze AUTO definitions model the strict rear-guard comparison before prompting", () => {
  let count = 0;
  for (const cardDefinition of catalog) for (const ability of Engine.parseCardAbilitiesCached(cardDefinition)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    count++;
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.deepEqual(ability.conditions, [{ type: "controller-has-more-rear-guards-than-opponent" }]);
    assert.equal(ability.trigger.eventType, "attack.step-started");
    assert.equal(ability.trigger.subject, "controller");
  }
  assert.equal(count, 27);
  assert.equal(Reducer.supportsServerEffectOperation("set-blazing"), false);
});

test("the host and joining player resolve their own Blaze AUTO at a controller attack step", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup({ side });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.side, side);
    const result = resolve(fixture);
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.own.vanguard.blazing, true);
    assert.equal(fixture.own.vanguard.blazingExpiry, fixture.ownerId);
    assert.equal(Boolean(fixture.opposing.vanguard.blazing), false);
    assert.equal(fixture.own.rear[0].blazing, undefined);
  }
});

test("Blaze does not prompt without more Rear-Guards or on the wrong attack step", () => {
  const equal = setup({ rearCounts: [2, 2] });
  assert.equal(equal.discovery.queued.length, 0);
  assert.equal(equal.state.pendingAbility, null);

  const firstOnly = setup({ sourceCardId: "cfa-3669", rearCounts: [3, 1], attackCount: 2 });
  assert.equal(firstOnly.discovery.queued.length, 0);

  const eachAttack = setup({ sourceCardId: "cfa-3786", rearCounts: [3, 1], attackCount: 2 });
  assert.equal(eachAttack.discovery.queued.length, 1);

  const opponentTurn = setup({ side: "human" });
  const wrongTurnEvent = Engine.createGameEvent(opponentTurn.state, {
    type: "attack.step-started", actingPlayerId: opponentTurn.opponentId, turnPlayerId: opponentTurn.opponentId,
    sourceCardInstanceId: "opponent-attacker", sourceControllerPlayerId: opponentTurn.opponentId,
    subjectCardInstanceId: "opponent-attacker", subjectControllerPlayerId: opponentTurn.opponentId,
    battleId: "opponent-battle", playerAttackCount: 1
  });
  opponentTurn.state.pendingAbility = null;
  opponentTurn.state.pendingAbilities = [];
  assert.equal(Reducer.discoverAutoTriggers(opponentTurn.state, [wrongTurnEvent], Engine).queued.length, 0);
});

test("Blaze source circle, choice authority, and duplicate event identity are enforced", () => {
  const rearOnly = setup({ sourceCardId: "cfa-4820" });
  assert.equal(rearOnly.source.zone, "rear-guard");
  assert.equal(rearOnly.discovery.queued.length, 1);

  const proxy = setup({ side: "bot" });
  assert.equal(resolve(proxy, "auth-host").ok, false);
  const accepted = resolve(proxy);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(resolve(proxy).ok, false);

  const duplicate = setup();
  const repeated = Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine);
  assert.equal(repeated.queued.length, 0);
});
