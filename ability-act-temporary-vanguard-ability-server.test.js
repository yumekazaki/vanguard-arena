"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-3102";
const ABILITY_ID = "cfa-3102:0";
const PATTERN = "act-vanguard-retire-two-power-grant-vanguard-hit-retire-two-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
let serial = 0;

function make(cardId, uid, playerId, extra = {}) {
  const definition = byId.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId}`);
  return { uid, cardId: String(cardId), cardName: definition.name, grade: Number(definition.grade), type: definition.type,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(side = "bot", options = {}) {
  const id = ++serial, otherSide = side === "human" ? "bot" : "human";
  const actorId = side === "human" ? "player-host" : "player-guest", opponentId = otherSide === "human" ? "player-host" : "player-guest";
  const source = make(CARD_ID, `gilvease-${id}`, actorId, { zone: options.wrongZone ? "rear-guard" : "vanguard", circle: options.wrongZone ? "rear-left" : "vanguard" });
  const own = { playerId: actorId, vanguard: options.wrongZone ? null : source, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] };
  const opponent = { playerId: opponentId, vanguard: make("cfa-3", `enemy-vg-${id}`, opponentId, { zone: "vanguard", circle: "vanguard" }), rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] };
  if (!options.notEnoughRearGuards) {
    for (let index = 0; index < 2; index++) own.rear[index] = make("cfa-3", `own-rc-${id}-${index}`, actorId, { zone: "rear-guard", circle: index ? "rear-right" : "rear-left" });
  }
  if (!options.noGenerationBreak) own.gZone.push(make("cfa-4", `face-up-g-${id}`, actorId, { zone: "g-zone", gDeckCard: true, isGUnit: true, faceUp: true }));
  const players = { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent };
  const state = { matchId: `gilvease-${id}`, stateVersion: 2, eventSequence: 0, processedActionIds: [], processedEventIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, pendingAttack: null,
    pendingTurnEnd: null, side, phase: 4, turn: 5, players };
  return { state, side, otherSide, actorId, opponentId, own, opponent, source, costUids: own.rear.filter(Boolean).map(card => card.uid) };
}

function activate(f, selection = {}, authUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId = `activate-${f.state.matchId}-${f.state.stateVersion}`) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ABILITY_ID,
      selection: { costSelections: { cb: [], sb: [], discard: [], gradeSumDiscard: [], reveal: [], retireRearGuard: f.costUids }, ...selection } }
  }, SEATS, Engine);
}

function attackEvent(f, attackerUid = f.source.uid, target = f.opponent.vanguard, suffix = "hit") {
  const battleId = `battle-${f.state.matchId}-${suffix}`;
  f.state.pendingAttack = { battleId, attackerSide: f.side, attackerPlayerId: f.actorId, attackerUid,
    attackerZone: attackerUid === f.source.uid ? "vanguard" : "rear-left", defenderSide: f.otherSide,
    targetUid: target.uid, targetZone: "vanguard", power: 30000, targetPower: 10000, critical: 1 };
  return Engine.createGameEvent(f.state, { type: "attack.hit", actingPlayerId: f.actorId, turnPlayerId: f.actorId,
    sourceCardInstanceId: attackerUid, sourceOwnerPlayerId: f.actorId, sourceControllerPlayerId: f.actorId,
    subjectCardInstanceId: target.uid, subjectOwnerPlayerId: f.opponentId, subjectControllerPlayerId: f.opponentId,
    targetCardInstanceIds: [target.uid], targetLocation: "vanguard", attackingUnitInstanceId: attackerUid,
    previousLocation: "vanguard", currentLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-hit" });
}

function resolveChild(f, targetUids, authUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId: `resolve-${f.state.matchId}-${f.state.stateVersion}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true,
      selection: { instanceUid: pending.instance.uid, abilityId: pending.ability.id, targetUids } }
  }, SEATS, Engine);
}

test("the exact official ACT is modeled as a VC, Generation Break 1, once-per-turn ability", () => {
  const card = byId.get(CARD_ID), ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === ABILITY_ID);
  assert.ok(ability);
  assert.equal(ability.definition.source.patternId, PATTERN);
  assert.equal(ability.definition.source.officialCardNumber, "G-BT04/029EN");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.deepEqual(ability.conditions, [{ type: "generation-break", count: 1 }]);
  assert.equal(ability.once, true);
  assert.deepEqual(ability.costs, [{ type: "retire-rear-guard", count: 2, targetFilter: { controller: "source-controller", zone: "rear-guard", excludeSource: true } }]);
  assert.deepEqual(ability.definition.effects.map(step => step.op), ["modify-power", "grant-temporary-ability"]);
  assert.equal(ability.definition.effects[0].amount, 5000);
  assert.equal(ability.definition.effects[1].grantedAbility.trigger.eventType, "attack.hit");
  assert.equal(ability.definition.effects[1].grantedAbility.trigger.subject, "source");
  assert.deepEqual(ability.definition.effects[1].grantedAbility.effects, [{ op: "retire-up-to-targets", target: "chosen", maximum: 2, targetFilter: { controller: "opponent", zone: "rear-guard" } }]);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player can each pay two of their own Rear-Guards and grant power plus an instance-bound AUTO", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side), expectedAuth = side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
    const result = activate(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.rear.filter(Boolean).length, 0);
    assert.deepEqual(f.own.drop.map(card => card.uid), f.costUids);
    assert.equal(f.opponent.drop.length, 0);
    assert.equal(f.source.turnPowerBoost, 5000);
    assert.equal(f.source.temporaryGrantedAbilities.length, 1);
    assert.equal(f.source.temporaryGrantedAbilities[0].instanceId, f.source.uid);
    assert.equal(f.source.temporaryGrantedAbilities[0].controllerPlayerId, f.actorId);
    assert.equal(f.source.temporaryGrantedAbilities[0].turnId, f.state.turn);
    assert.equal(f.source.temporaryGrantedAbilities[0].grantId, `${f.source.uid}:${ABILITY_ID}:${f.state.turn}`);
    const second = activate(f, {}, expectedAuth, `second-${f.state.matchId}`);
    assert.equal(second.ok, false);
    assert.equal(second.reason, "activation-usage-restriction");
  }
});

test("illegal location, missing GB, insufficient cost, forged player, and invalid selected cost reject without partial changes", () => {
  const cases = [
    ["wrong circle", fixture("bot", { wrongZone: true }), f => activate(f)],
    ["missing Generation Break", fixture("bot", { noGenerationBreak: true }), f => activate(f)],
    ["not enough Rear-Guards", fixture("bot", { notEnoughRearGuards: true }), f => activate(f)],
    ["forged host resolving the guest action", fixture("bot"), f => activate(f, {}, SEATS.hostAuthUid)],
    ["opponent Rear-Guard as a cost", fixture("bot"), f => activate(f, { costSelections: { cb: [], sb: [], discard: [], gradeSumDiscard: [], reveal: [], retireRearGuard: [f.opponent.vanguard.uid, f.costUids[0]] } })],
  ];
  for (const [label, f, run] of cases) {
    const before = JSON.stringify(f.state), result = run(f);
    assert.equal(result.ok, false, `${label}: ${result.reason}`);
    assert.equal(JSON.stringify(f.state), before, `${label} must not partially change the match`);
  }
});

test("the granted AUTO matches only this Vanguard's hit and retires zero through two selected opposing Rear-Guards", () => {
  const f = fixture("bot");
  assert.equal(activate(f).ok, true);
  const unrelated = make("cfa-3", `unrelated-${f.state.matchId}`, f.actorId, { zone: "rear-guard", circle: "rear-left" });
  f.own.rear[0] = unrelated;
  assert.equal(Reducer.discoverAutoTriggers(f.state, [attackEvent(f, unrelated.uid, undefined, "unrelated")], Engine).queued.length, 0);

  const first = make("cfa-3", `enemy-rc-1-${f.state.matchId}`, f.opponentId, { zone: "rear-guard", circle: "rear-left" });
  const second = make("cfa-3", `enemy-rc-2-${f.state.matchId}`, f.opponentId, { zone: "rear-guard", circle: "rear-right" });
  f.opponent.rear[0] = first; f.opponent.rear[1] = second;
  const hit = attackEvent(f);
  const discovered = Reducer.discoverAutoTriggers(f.state, [hit], Engine);
  assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.actorId);
  const forged = resolveChild(f, [first.uid], SEATS.hostAuthUid);
  assert.equal(forged.ok, false);
  const wrongTarget = resolveChild(f, [unrelated.uid]);
  assert.equal(wrongTarget.ok, false);
  assert.equal(f.opponent.rear[0].uid, first.uid);
  assert.equal(f.opponent.rear[1].uid, second.uid);
  const resolved = resolveChild(f, [first.uid, second.uid]);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(f.opponent.rear[0], null);
  assert.equal(f.opponent.rear[1], null);
  assert.deepEqual(f.opponent.drop.map(card => card.uid), [first.uid, second.uid]);
  assert.equal(f.source.temporaryGrantedAbilities.length, 1);
});

test("the mandatory granted AUTO legally resolves with no targets and expires outside its grant turn", () => {
  const f = fixture("human");
  assert.equal(activate(f).ok, true);
  const discovered = Reducer.discoverAutoTriggers(f.state, [attackEvent(f)], Engine);
  assert.equal(discovered.queued.length, 1);
  const result = resolveChild(f, []);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.opponent.drop.length, 0);
  assert.equal(Engine.createTemporaryGrantedAbility(f.source.temporaryGrantedAbilities[0], f.source, f.state.turn + 1), null);
});
