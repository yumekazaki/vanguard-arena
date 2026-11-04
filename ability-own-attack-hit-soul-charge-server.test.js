"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-10069";
const ABILITY_ID = `${CARD_ID}:0`;
const PRINTED_TEXT = "AUTO [VC/RC]: When this unit’s attack hits a vanguard, Soul Charge 1.";
const PATTERN_ID = "auto-own-attack-hit-soul-charge-one-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => String(card.id) === CARD_ID);
let fixtureSequence = 0;

function card(uid, cardId, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: definition?.name || "Test unit", type: definition?.type || "Unit", grade: definition?.grade ?? 0,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra };
}

function makeFixture(side = "human", zone = "vanguard") {
  const index = ++fixtureSequence;
  const opponentSide = side === "human" ? "bot" : "human";
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const defenderPlayerId = side === "human" ? "guest-player" : "host-player";
  const source = card(`jewelneel-${index}`, CARD_ID, sourcePlayerId);
  const target = card(`opponent-vg-${index}`, "cfa-3", defenderPlayerId, { grade: 3 });
  const charged = card(`top-card-${index}`, "cfa-10", sourcePlayerId);
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const sourceLocation = zone === "vanguard" ? "vanguard" : "rear-left";
  if (zone === "vanguard") players[side].vanguard = source;
  else players[side].vanguard = card(`own-vg-${index}`, "cfa-10", sourcePlayerId, { grade: 3 });
  if (zone !== "vanguard") players[side].rear[0] = source;
  players[side].deck = [charged];
  players[side].soul = [];
  players[opponentSide].vanguard = target;

  const battleId = `jewelneel-hit-${index}`;
  const state = { matchId: `jewelneel-match-${index}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId, closing: true, attackerSide: side, attackerPlayerId: sourcePlayerId, attackerUid: source.uid, attackerZone: sourceLocation,
      defenderSide: opponentSide, targetUid: target.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: 1 } };
  const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);
  assert.ok(ability, "the exact catalog skill compiles");
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderPlayerId, subjectControllerPlayerId: defenderPlayerId,
    targetCardInstanceIds: [target.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid, currentLocation: sourceLocation,
    previousLocation: sourceLocation, battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, ability, event, source, target, charged, side, sourcePlayerId, defenderPlayerId, battleId };
}

function discover(fixture, event = fixture.event) { return Reducer.discoverAutoTriggers(fixture.state, [event], Engine); }

function resolve(fixture, authUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId: `resolve-${fixture.battleId}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } } }, seats, Engine);
}

test("Jewelneel's exact mandatory attack-hit AUTO compiles to the reviewed server effect", () => {
  assert.ok(cardDefinition);
  assert.equal(cardDefinition.name, "Demonic Stone Dragon, Jewelneel");
  assert.equal(cardDefinition.text.includes("When this unit’s attack hits a vanguard, Soul Charge 1."), true);
  const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);
  assert.equal(ability.printedText, PRINTED_TEXT);
  assert.equal(ability.definition.source.patternId, PATTERN_ID);
  assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(ability.trigger.eventType, "attack.hit");
  assert.equal(ability.trigger.subject, "source");
  assert.equal(ability.canDecline, false);
  assert.deepEqual(ability.effects, [{ op: "soul-charge", count: 1 }]);
  assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player resolve only their own VC or RC attack-hit Soul Charge", () => {
  for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-left"]) {
    const fixture = makeFixture(side, zone);
    const result = discover(fixture);
    assert.equal(result.queued.length, 1, JSON.stringify(result));
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(discover(fixture).queued.length, 0, "replayed events cannot queue the skill twice");

    const resolved = resolve(fixture);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.deepEqual(fixture.state.players[side].soul.map(item => item.uid), [fixture.charged.uid]);
    assert.deepEqual(fixture.state.players[side].deck, []);
    assert.deepEqual(fixture.state.players[side === "human" ? "bot" : "human"].soul, []);
  }
});

test("another unit, a non-Vanguard hit, stale battle data, and host proxy cannot resolve it", () => {
  const unrelated = makeFixture();
  const unrelatedEvent = { ...unrelated.event, eventId: "unrelated-attacker-event", sourceCardInstanceId: "other-unit", attackingUnitInstanceId: "other-unit" };
  assert.equal(discover(unrelated, unrelatedEvent).queued.length, 0);

  const wrongTarget = makeFixture();
  assert.equal(discover(wrongTarget, { ...wrongTarget.event, eventId: "rear-guard-hit-event", targetLocation: "rear-left" }).queued.length, 0);

  const stale = makeFixture();
  stale.state.pendingAttack.battleId = "different-battle";
  assert.equal(discover(stale).queued.length, 0);

  const proxy = makeFixture("bot", "rear-left");
  assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  const rejected = resolve(proxy, seats.hostAuthUid);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("a forged source definition is not server executable", () => {
  const fixture = makeFixture();
  const forged = structuredClone(fixture.ability);
  forged.definition.effects[0].count = 2;
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
