"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const batch = require("./ability-contributions/batch-ABILITY-320008F1-0014.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function abilityFor(id) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  const card = cards.get(cardId);
  assert.ok(card, `catalog contains ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `parsed ${id}`);
  return { card, ability };
}

function instance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || cardId, type: definition?.type || "Unit",
    grade: Number(definition?.grade || 0), power: Number(definition?.power || 10000), unitCard: true,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function revolDressFixture(side = "human") {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = instance("cfa-10361", `tempest-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const rider = instance("cfa-10130", `revol-${side}`, playerId, { zone: "soul" });
  const makePlayer = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].vanguard = source;
  players[side].soul = [rider];
  players[opponentSide].vanguard = instance("cfa-14", `opp-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: `batch14-revol-${side}`, stateVersion: 1, turn: 4, phase: 6, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingTurnEnd: { side, playerId, turn: 4, cleanupQueued: false }, players };
  const ability = Engine.parseCardAbilitiesCached(cards.get("cfa-10361")).find(item => item.id === "cfa-10361:1");
  return { state, source, rider, ability, side, playerId, opponentSide };
}

function endEvent(fixture, overrides = {}) {
  const event = Engine.createGameEvent(fixture.state, { type: "turn.ended", actingPlayerId: fixture.playerId,
    turnPlayerId: fixture.playerId, phase: "end", timingWindow: "turn-end", ...overrides });
  fixture.state.pendingTurnEnd.turnEndEvent = event;
  fixture.state.pendingTurnEnd.turnEndEventId = event.eventId;
  return event;
}

test("batch audit accounts for all 34 exact ability IDs and leaves unsupported siblings blocked", () => {
  assert.equal(batch.audit.batchId, "ABILITY-320008F1-0014");
  assert.equal(batch.abilityIds.length, 34);
  assert.equal(new Set(batch.abilityIds).size, 34);
  assert.equal(batch.alreadySupportedAbilityIds.length, 4);
  assert.equal(batch.unsupported.length, 30);
  assert.equal(batch.unsupported.every(row => row.blocker.length > 40), true);
  assert.equal(batch.audit.proposedDefinitionIds.length, 0);
  assert.equal(batch.audit.implementedAbilityIds.length, 0);
});

test("the Youthberk end-turn AUTO resolves on the exact source for either online seat", () => {
  const { ability } = abilityFor("cfa-10361:1");
  assert.equal(ability.definition?.source?.patternId, "auto-vc-end-turn-revoldress-ride-from-soul-rest-v1");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  for (const side of ["human", "bot"]) {
    const f = revolDressFixture(side);
    const event = endEvent(f);
    const discovered = Reducer.discoverAutoTriggers(f.state, [event], Engine);
    assert.equal(discovered.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const wrongActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const denied = Reducer.applyAbilityDecision(f.state, { actorAuthUid: wrongActor, actionId: `wrong-seat-${side}`,
      expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: ability.id, effectUid: f.rider.uid } } }, seats, Engine);
    assert.equal(denied.ok, false, `${side}: opponent cannot resolve this player's ability`);
    const ownerAuth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = Reducer.applyAbilityDecision(f.state, { actorAuthUid: ownerAuth, actionId: `resolve-${side}`,
      expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: ability.id, effectUid: f.rider.uid } } }, seats, Engine);
    assert.equal(resolved.ok, true, JSON.stringify(resolved));
    assert.equal(f.state.players[side].vanguard.uid, f.rider.uid);
    assert.equal(f.state.players[side].vanguard.rested, true);
    assert.ok(f.state.players[side].soul.some(card => card.uid === f.source.uid));
  }
});

test("Youthberk's end-turn AUTO rejects another source, the wrong turn, and a source no longer on VC", () => {
  const { ability } = abilityFor("cfa-10361:1");
  const wrongSource = revolDressFixture("human");
  const event = endEvent(wrongSource, { sourceCardInstanceId: "unrelated", cardInstanceId: "unrelated", subjectCardInstanceId: "unrelated" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [event], Engine).queued.length, 0);
  const wrongTurn = revolDressFixture("human");
  assert.equal(Reducer.discoverAutoTriggers(wrongTurn.state, [endEvent(wrongTurn, { turnPlayerId: "guest-player" })], Engine).queued.length, 0);
  const moved = revolDressFixture("human");
  moved.state.players.human.vanguard = null;
  moved.state.players.human.rear[0] = moved.source;
  assert.equal(Reducer.discoverAutoTriggers(moved.state, [endEvent(moved)], Engine).queued.length, 0);
  assert.equal(ability.requiredLocation.includes("vanguard"), true);
});

test("the assigned CONT records preserve exact locations and conditions", () => {
  const opponentGrade = abilityFor("cfa-10379:0").ability;
  assert.equal(opponentGrade.definition?.source?.patternId, "cont-rc-opponent-vanguard-grade-power-v1");
  assert.deepEqual(opponentGrade.requiredLocation, ["rear-guard"]);
  assert.equal(Engine.evaluateContinuousEffects([opponentGrade], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 5000);
  assert.equal(Engine.evaluateContinuousEffects([opponentGrade], { location: "rear-guard", opponentVanguardGrade: 2, isControllerTurn: true }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([opponentGrade], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: false }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([opponentGrade], { location: "vanguard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 0);

  const namedSoul = abilityFor("cfa-1038:1").ability;
  assert.equal(namedSoul.definition?.source?.patternId, "cont-named-soul-card-power-v1");
  assert.equal(Engine.evaluateContinuousEffects([namedSoul], { location: "vanguard", soulCardNames: ["Dragonic Kaiser Vermillion"] }).power, 2000);
  assert.equal(Engine.evaluateContinuousEffects([namedSoul], { location: "vanguard", soulCardNames: ["Dragonic Kaiser Vermillion \"THE BLOOD\""] }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([namedSoul], { location: "rear-guard", soulCardNames: ["Dragonic Kaiser Vermillion"] }).power, 0);

  const lord = abilityFor("cfa-1038:2").ability;
  assert.equal(lord.definition?.continuousRestrictions?.[0]?.type, "lord");
  const sourceCard = cards.get("cfa-1038");
  const foreignCard = { clan: "Kagero", clans: ["Kagero"] };
  const sameCard = { clan: "Narukami", clans: ["Narukami"] };
  const source = { uid: "blood", card: sourceCard };
  const foreign = { uid: "foreign", card: foreignCard };
  const same = { uid: "same", card: sameCard };
  assert.equal(Engine.evaluateContinuousRestrictions([lord], { sourceInstanceId: source.uid, sourceCard, location: "vanguard", controlledUnits: [source, foreign] }).legal, false);
  assert.equal(Engine.evaluateContinuousRestrictions([lord], { sourceInstanceId: source.uid, sourceCard, location: "vanguard", controlledUnits: [source, same] }).legal, true);
  assert.equal(Engine.evaluateContinuousRestrictions([lord], { sourceInstanceId: source.uid, sourceCard, location: "guardian", controlledUnits: [source, foreign] }).legal, true);
});
