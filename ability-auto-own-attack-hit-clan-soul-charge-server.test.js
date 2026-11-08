"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-467", { clan: "Dark Irregulars", name: "Blue Dust" }],
  ["cfa-535", { clan: "Kagero", name: "Flame Edge Dragon" }],
  ["cfa-811", { clan: "Pale Moon", name: "Hungry Clown" }]
]);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
let sequence = 0;

function card(uid, cardId, playerId, extra = {}) {
  const def = byId.get(String(cardId));
  return { uid, cardId, cardName: def?.name || "Test unit", type: def?.type || "Unit", grade: Number(def?.grade || 0),
    clan: def?.clan || "", clans: def?.clans || [], ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra };
}

function makeFixture({ cardId = "cfa-467", side = "human", sourceZone = "vanguard", targetZone = "vanguard", clanMatch = true } = {}) {
  const id = ++sequence, spec = FAMILY.get(cardId), enemySide = side === "human" ? "bot" : "human";
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const defenderPlayerId = side === "human" ? "guest-player" : "host-player";
  const sourceDef = byId.get(cardId);
  const source = card(`source-${id}`, cardId, sourcePlayerId);
  const ownVanguardDef = clanMatch
    ? catalog.find(item => item.clan === spec.clan && Number(item.grade) === 3 && /unit/i.test(item.type || ""))
    : catalog.find(item => item.clan !== spec.clan && Number(item.grade) === 3 && /unit/i.test(item.type || ""));
  assert.ok(ownVanguardDef, `fixture has a ${clanMatch ? spec.clan : "different-clan"} Grade 3 Vanguard`);
  const ownVanguard = card(`own-vg-${id}`, ownVanguardDef.id, sourcePlayerId);
  const target = card(`target-${id}`, "cfa-3", defenderPlayerId, { grade: 1 });
  const charged = card(`soul-top-${id}`, "cfa-10", sourcePlayerId);
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = sourceZone === "vanguard" ? source : ownVanguard;
  if (sourceZone !== "vanguard") players[side].rear[0] = source;
  players[enemySide].vanguard = targetZone === "vanguard" ? target : card(`enemy-vg-${id}`, "cfa-10", defenderPlayerId, { grade: 3 });
  if (targetZone !== "vanguard") {
    assert.equal(targetZone, "rear-left");
    target.zone = "rear-guard";
    target.circle = targetZone;
    players[enemySide].rear[0] = target;
  }
  players[side].deck = [charged];
  const battleId = `clan-soul-hit-${id}`;
  const state = { matchId: `clan-soul-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId, closing: false, attackerSide: side, attackerPlayerId: sourcePlayerId, attackerUid: source.uid,
      attackerZone: sourceZone === "vanguard" ? "vanguard" : "rear-left", defenderSide: enemySide, defenderPlayerId,
      targetUid: target.uid, targetZone, power: 20000, targetPower: 10000, critical: 1 } };
  const sourceAbility = Engine.parseCardAbilitiesCached(sourceDef).find(ability => ability.id === `${cardId}:0`);
  assert.ok(sourceAbility, `${cardId} AUTO parses`);
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderPlayerId, subjectControllerPlayerId: defenderPlayerId,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, attackingUnitInstanceId: source.uid,
    attackingCardInstanceIds: [source.uid], currentLocation: sourceZone === "vanguard" ? "vanguard" : "rear-left",
    previousLocation: sourceZone === "vanguard" ? "vanguard" : "rear-left", battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, ability: sourceAbility, event, source, target, charged, sourceZone, targetZone, side, enemySide, sourcePlayerId, defenderPlayerId, battleId, spec };
}

function discover(fixture, event = fixture.event) { return Reducer.discoverAutoTriggers(fixture.state, [event], Engine); }
function resolve(fixture, accept = true, authUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId: `resolve-${fixture.battleId}-${accept}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } } }, seats, Engine);
}

test("three exact clan-gated attack-hit AUTOs are optional, own-source, and server supported", () => {
  for (const [cardId, spec] of FAMILY) {
    const def = byId.get(cardId), ability = Engine.parseCardAbilitiesCached(def).find(item => item.id === `${cardId}:0`);
    assert.equal(def.name, spec.name);
    assert.equal(ability.definition.source.patternId, "auto-own-attack-hit-clan-soul-charge-one-v1");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "attack.hit", subject: "source", circles: [] });
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: spec.clan }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.effects, [{ op: "soul-charge", target: "controller", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player can resolve their own optional hit AUTO from VC or RC against either opposing circle", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-left"]) for (const targetZone of ["vanguard", "rear-left"]) {
    const fixture = makeFixture({ cardId, side, sourceZone, targetZone });
    const result = discover(fixture);
    assert.equal(result.queued.length, 1, `${cardId} ${side} ${sourceZone} -> ${targetZone}: ${JSON.stringify(result)}`);
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.sourcePlayerId);
    assert.equal(discover(fixture).queued.length, 0, "the same event cannot queue a second prompt");
    const resolved = resolve(fixture);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.deepEqual(fixture.state.players[side].soul.map(item => item.uid), [fixture.charged.uid]);
    assert.deepEqual(fixture.state.players[side].deck, []);
    assert.deepEqual(fixture.state.players[fixture.enemySide].soul, []);
  }
});

test("a Rear-Guard hit still matches the battle snapshot after that target has moved to Drop", () => {
  const fixture = makeFixture({ cardId: "cfa-811", side: "bot", sourceZone: "rear-left", targetZone: "rear-left" });
  const { state, event, target, enemySide, battleId, source, sourcePlayerId } = fixture;
  const attackStart = Engine.createGameEvent(state, { type: "attack.step-started", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: sourcePlayerId, subjectControllerPlayerId: sourcePlayerId,
    attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid], targetCardInstanceIds: [target.uid], targetLocation: "rear-left",
    currentLocation: "rear-left", previousLocation: "rear-left", battleId, phase: "battle", timingWindow: "attack-step-start" });
  assert.equal(discover(fixture, attackStart).queued.length, 0);
  const attackAtClose = { ...state.pendingAttack, closing: true };
  state.players[enemySide].rear[0] = null;
  target.zone = "drop";
  target.circle = null;
  state.players[enemySide].drop.push(target);
  state.closedBattleContexts = { [battleId]: { battleId, turn: state.turn, attackAtClose } };
  state.pendingAttack = null;
  assert.equal(discover(fixture, event).queued.length, 1);
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  const result = resolve(fixture);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(state.players.bot.soul.map(item => item.uid), [fixture.charged.uid]);
});

test("wrong source, wrong clan, mismatched target, and host proxy do not activate or resolve it", () => {
  const otherSource = makeFixture({ cardId: "cfa-535", side: "bot" });
  assert.equal(discover(otherSource, { ...otherSource.event, eventId: "other-source", sourceCardInstanceId: "another-unit", attackingUnitInstanceId: "another-unit" }).queued.length, 0);
  const wrongClan = makeFixture({ cardId: "cfa-467", side: "bot", sourceZone: "rear-left", clanMatch: false });
  assert.equal(discover(wrongClan).queued.length, 0);
  const mismatchedTarget = makeFixture({ cardId: "cfa-811", side: "bot" });
  assert.equal(discover(mismatchedTarget, { ...mismatchedTarget.event, eventId: "wrong-target-location", targetLocation: "rear-left" }).queued.length, 0);
  const proxy = makeFixture({ cardId: "cfa-535", side: "bot" });
  assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  const rejected = resolve(proxy, true, seats.hostAuthUid);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("declining consumes the prompt without charging Soul, and the clan condition is rechecked at resolution", () => {
  const declined = makeFixture({ cardId: "cfa-467" });
  assert.equal(discover(declined).queued.length, 1);
  const no = resolve(declined, false);
  assert.equal(no.ok, true, no.reason);
  assert.equal(declined.state.pendingAbility, null);
  assert.deepEqual(declined.state.players.human.soul, []);
  assert.equal(declined.state.players.human.deck.length, 1);

  const staleCondition = makeFixture({ cardId: "cfa-811", side: "bot", sourceZone: "rear-left" });
  assert.equal(discover(staleCondition).queued.length, 1);
  const replacement = catalog.find(item => item.clan !== staleCondition.spec.clan && Number(item.grade) === 3 && /unit/i.test(item.type || ""));
  staleCondition.state.players.bot.vanguard = card("replacement-vanguard", replacement.id, staleCondition.sourcePlayerId);
  const before = JSON.stringify(staleCondition.state);
  const rejected = resolve(staleCondition);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /condition-no-longer-met/);
  assert.equal(staleCondition.state.players.bot.soul.length, 0);
  assert.equal(JSON.stringify(staleCondition.state), before);
});

test("the authoritative whitelist rejects forged clan, optionality, or effect data", () => {
  const fixture = makeFixture({ cardId: "cfa-467" });
  for (const mutate of [
    ability => { ability.definition.conditions[0].value = "Kagero"; },
    ability => { ability.definition.optional = false; },
    ability => { ability.definition.effects[0].count = 2; }
  ]) {
    const forged = structuredClone(fixture.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
