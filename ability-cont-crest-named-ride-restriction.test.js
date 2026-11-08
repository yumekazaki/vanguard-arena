"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CASES = [
  { crestId: "cfa-10476", name: "Chronojet", unitId: "cfa-2480", rideText: "CONT: You can Stride, and cannot ride any grade 3 or greater card without \"Chronojet\" in its card name." },
  { crestId: "cfa-10668", name: "Messiah", unitId: "cfa-2881", cardNumber: "D-SS04/T01EN" },
  { crestId: "cfa-12182", name: "Demon Stealth Dragon, Shiranui", unitId: "cfa-4827", cardNumber: "D-SS09/T01EN" },
  { crestId: "cfa-12183", name: "Luard", unitId: "cfa-4226", cardNumber: "D-SS10/T01EN" },
  { crestId: "cfa-13177", name: "Nightrose", unitId: "cfa-3422", cardNumber: "DZ-SS03/T01EN" },
  { crestId: "cfa-13186", name: "Harri", unitId: "cfa-3280", cardNumber: "DZ-SS02/T01EN" }
];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function definition(cardId) {
  const card = catalog.get(cardId);
  assert.ok(card, `${cardId} is in the catalog`);
  return card;
}

function cardInstance(cardId, uid, playerId) {
  const card = definition(cardId);
  return { uid, cardId, cardName: card.name, type: card.type, unitCard: /unit/i.test(String(card.type)),
    grade: Number(card.grade), power: Number(card.power || 0), critical: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false };
}

function abilityFor(item) {
  const { crestId, name } = item;
  const card = definition(crestId);
  const printedText = item.rideText || "CONT: You can perform Stride, and cannot ride grade 3 or greater cards without \"" + name + "\" in their card names.";
  assert.ok(card.text.includes(printedText), `${crestId} retains the exact printed text`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${crestId}:0`);
  assert.ok(ability?.definition, `${crestId}:0 compiles`);
  return ability;
}

function makeRideState({ item, side, riderId }) {
  const actorId = side === "human" ? "host-player" : "joining-player";
  const opponentId = side === "human" ? "joining-player" : "host-player";
  const rider = cardInstance(riderId, `rider-${item.crestId}-${side}-${riderId}`, actorId);
  const vanguard = cardInstance("cfa-14", `vanguard-${item.crestId}-${side}`, actorId);
  const opponentVanguard = cardInstance("cfa-3", `opponent-vanguard-${item.crestId}-${side}`, opponentId);
  const cost = cardInstance("cfa-14", `cost-${item.crestId}-${side}`, actorId);
  const crest = { ...cardInstance(item.crestId, `crest-${item.crestId}-${side}`, actorId), type: "Crest" };
  const makePlayer = playerId => ({ playerId, format: "premium", vanguard: null, hand: [], deck: [], rideDeck: [],
    soul: [], drop: [], damage: [], bind: [], rear: Array(5).fill(null), guardCircle: [], orders: [],
    gDeck: [], gZone: [], extra: [], crests: [], energy: 0 });
  const players = { human: makePlayer("host-player"), bot: makePlayer("joining-player") };
  const player = side === "human" ? players.human : players.bot;
  const opponent = side === "human" ? players.bot : players.human;
  player.vanguard = vanguard;
  player.hand = [rider, cost];
  player.crests = [crest];
  opponent.vanguard = opponentVanguard;
  const state = { matchId: `named-crest-ride-${item.crestId}-${side}-${riderId}`, stateVersion: 0,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], eventSequence: 0,
    turn: 2, side, phase: 2, firstTurnComplete: true, ridePerformed: false, pendingAbilities: [], players };
  return { state, rider, player, vanguard };
}

function performRide(fixture, id) {
  const actorAuthUid = fixture.state.side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid, actionId: id, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "game-action", action: "ride", cardInstanceId: fixture.rider.uid }
  }, seats, Engine);
}

test("all five official Stride Crests compile their exact name-filtered ride restriction as passive CONT abilities", () => {
  for (const item of CASES) {
    const ability = abilityFor(item);
    assert.equal(ability.kind, "CONT", item.crestId);
    assert.deepEqual(ability.requiredLocation, ["crest"], item.crestId);
    assert.equal(ability.definition.source?.patternId, "cont-crest-grade-three-named-ride-restriction-v1");
    assert.equal(ability.definition.source?.officialTextVerified, true, item.crestId);
    assert.equal(ability.definition.source?.officialCardNumber, item.cardNumber, item.crestId);
    assert.deepEqual(ability.definition.continuousRestrictions, [
      { type: "ride-grade-three-name-restricted", minimumGrade: 3, name: item.name }
    ]);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${item.crestId}: CONT never prompts Activate Skill`);
  }
});

test("Grade 3 or greater candidates require the exact Crest name; Grade 2 rides stay unrestricted", () => {
  for (const item of CASES) {
    const crest = cardInstance(item.crestId, `crest-${item.crestId}`, "host-player");
    const matching = definition(item.unitId);
    const otherGradeThree = definition("cfa-100");
    assert.equal(Number(matching.grade), 3);
    assert.ok(matching.name.includes(item.name));
    assert.equal(Engine.canRideCard(matching, { crests: [crest] }), true, `${item.crestId}: matching Grade 3 allowed`);
    assert.equal(Engine.canRideCard({ ...matching, grade: 4 }, { crests: [crest] }), true, `${item.crestId}: matching Grade 4 allowed`);
    assert.equal(Engine.canRideCard(otherGradeThree, { crests: [crest] }), false, `${item.crestId}: unrelated Grade 3 rejected`);
    assert.equal(Engine.canRideCard({ ...otherGradeThree, grade: 4 }, { crests: [crest] }), false, `${item.crestId}: unrelated Grade 4 rejected`);
    assert.equal(Engine.canRideCard({ ...otherGradeThree, grade: 2 }, { crests: [crest] }), true, `${item.crestId}: Grade 2 remains legal`);
    assert.equal(Engine.canRideCard(otherGradeThree, { crests: [] }), true, `${item.crestId}: restriction is inactive without the Crest`);
  }
});

test("the authoritative reducer blocks unrelated Grade 3 rides for host and joining player without partial mutation", () => {
  for (const item of CASES) for (const side of ["human", "bot"]) {
    const matching = makeRideState({ item, side, riderId: item.unitId });
    const allowed = performRide(matching, `matching-${item.crestId}-${side}`);
    assert.equal(allowed.ok, true, `${item.crestId}/${side}: ${allowed.reason}`);
    assert.equal(allowed.state.players[side].vanguard.uid, matching.rider.uid);

    const unrelated = makeRideState({ item, side, riderId: "cfa-100" });
    const before = structuredClone(unrelated.state);
    const rejected = performRide(unrelated, `unrelated-${item.crestId}-${side}`);
    assert.equal(rejected.ok, false, `${item.crestId}/${side}: unrelated name is illegal`);
    assert.equal(rejected.reason, "ride-restriction", `${item.crestId}/${side}: authoritative restriction reason`);
    assert.deepEqual(unrelated.state, before, `${item.crestId}/${side}: rejected ride must not partially mutate state`);
  }
});
