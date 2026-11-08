"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SEATS = {
  hostAuthUid: "auth-host",
  guestAuthUid: "auth-guest",
  hostSide: "human",
  guestSide: "bot"
};
const PATTERN = "cont-ride-from-grade-and-named-vanguard-v1";
const byId = new Map(loadCatalog().map(card => [String(card.id), card]));

function card(id) {
  const result = byId.get(String(id));
  assert.ok(result, `expected catalog card ${id}`);
  return result;
}

function instance(definition, uid, playerId, location) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    type: definition.type,
    unitCard: /unit/i.test(String(definition.type || "")),
    grade: Number(definition.grade),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    location
  };
}

function makeState({ side, riderId, vanguardId, path }) {
  const actorId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const rider = instance(card(riderId), `rider-${side}-${path}`, actorId, path === "hand" ? "hand" : "ride-deck");
  const vanguard = instance(card(vanguardId), `vg-${side}`, actorId, "vanguard");
  const opponentVanguard = instance(card("cfa-3"), `enemy-vg-${side}`, otherId, "vanguard");
  const discard = instance(card("cfa-3"), `cost-${side}`, actorId, "hand");
  const player = {
    playerId: actorId,
    format: "standard",
    vanguard,
    hand: path === "hand" ? [rider] : [discard],
    rideDeck: path === "ride-deck" ? [rider] : [],
    deck: [], damage: [], drop: [], soul: [], bind: [],
    rear: Array(5).fill(null), guardCircle: [], orders: [], gDeck: [], gZone: [], extra: [], crests: [], energy: 0
  };
  const opponent = {
    playerId: otherId,
    vanguard: opponentVanguard,
    hand: [], rideDeck: [], deck: [], damage: [], drop: [], soul: [], bind: [],
    rear: Array(5).fill(null), guardCircle: [], orders: [], gDeck: [], gZone: [], extra: [], crests: [], energy: 0
  };
  const state = {
    matchId: `named-ride-${riderId}-${side}-${path}`,
    stateVersion: 0,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], eventSequence: 0,
    turn: 2,
    side,
    phase: 2,
    firstTurnComplete: true,
    ridePerformed: false,
    pendingAbilities: [],
    players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player }
  };
  return { state, player, rider, discard, actorId };
}

function ride(fixture, { path, actionId }) {
  const actorAuthUid = fixture.state.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  const payload = path === "hand"
    ? { action: "ride", cardInstanceId: fixture.rider.uid }
    : { action: "rideDeck", rideDeckCardInstanceId: fixture.rider.uid, discardCardInstanceId: fixture.discard.uid };
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload
  }, SEATS, Engine);
}

function rideAbility(cardId) {
  const ability = Engine.parseCardAbilities(card(cardId)).find(candidate => candidate.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 parses`);
  assert.equal(ability.kind, "CONT");
  assert.ok(ability.definition, `${cardId}:0 compiles`);
  assert.equal(ability.definition.source.patternId, PATTERN);
  assert.equal(Engine.isManuallyActivatable(ability), false, "a CONT ride restriction must never create an activation prompt");
  return ability;
}

test("cfa-9601:0 uses the official named Grade 3 ride restriction and is not an activation prompt", () => {
  const ability = rideAbility("cfa-9601");
  assert.equal(ability.definition.source.officialCardNumber, "D-TB03/001EN");
  assert.equal(ability.definition.source.cardTextVerification, "official-text-confirmed");
  assert.equal(ability.definition.printedText, ability.printedText);
  assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "ride-from-grade-and-name", grade: 3, name: "Yoh Asakura" }]);
});

test("cfa-9601:0 rejects wrong grade or name and accepts a legal ride for host and joining player", () => {
  rideAbility("cfa-9601");
  for (const side of ["human", "bot"]) for (const path of ["hand", "ride-deck"]) {
    const legal = makeState({ side, riderId: "cfa-9601", vanguardId: "cfa-8773", path });
    const result = ride(legal, { path, actionId: `legal-${side}-${path}` });
    assert.equal(result.ok, true, `${side}/${path}: ${result.reason}`);
    assert.equal(legal.player.vanguard.uid, legal.rider.uid);

    for (const [label, vanguardId] of [["wrong-name", "cfa-9228"], ["wrong-grade", "cfa-9627"]]) {
      const illegal = makeState({ side, riderId: "cfa-9601", vanguardId, path });
      const before = structuredClone(illegal.state);
      const rejected = ride(illegal, { path, actionId: `reject-${side}-${path}-${label}` });
      assert.equal(rejected.ok, false, `${side}/${path}/${label}`);
      assert.equal(rejected.reason, "ride-restriction", `${side}/${path}/${label}`);
      assert.deepEqual(illegal.state, before, `${side}/${path}/${label} must not partially mutate the match`);
    }
  }
});

test("cfa-9887:0 shares the CONT parser, with official card-text review still pending", () => {
  const ability = rideAbility("cfa-9887");
  assert.equal(ability.definition.source.cardTextVerification, "pending-official-source");
  assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "ride-from-grade-and-name", grade: 3, name: "Horohoro" }]);
  assert.equal(Engine.canRideCard(card("cfa-9887"), { vanguardCard: card("cfa-9228") }), true);
  assert.equal(Engine.canRideCard(card("cfa-9887"), { vanguardCard: card("cfa-9705") }), false);
  assert.equal(Engine.canRideCard(card("cfa-9887"), { vanguardCard: card("cfa-8773") }), false);
});

test("cfa-9748:0 stays unsupported while the local Faust VII text conflicts with available card-text evidence", () => {
  const ability = Engine.parseCardAbilities(card("cfa-9748")).find(candidate => candidate.id === "cfa-9748:0");
  assert.ok(ability);
  assert.match(ability.printedText, /Faust VII/);
  assert.equal(ability.definition, null);
});
