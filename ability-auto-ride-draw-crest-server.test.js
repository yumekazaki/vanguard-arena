"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Projection = require("./match-state-projection.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-ride-from-named-vanguard-draw-get-crest-v1";
const cards = [
  { cardId: "cfa-10475", previousId: "cfa-10474", riderName: "Chrono Dran", crestCardId: "cfa-10476", crestName: "Chronojet Dragon" },
  { cardId: "cfa-10764", previousId: "cfa-10763", riderName: "Neon Messiah", crestCardId: "cfa-10668", crestName: "Alter Ego Messiah" },
  { cardId: "cfa-12185", previousId: "cfa-12184", riderName: "Dragprince, Rute", crestCardId: "cfa-12183", crestName: "Dragheart, Luard" },
  { cardId: "cfa-13174", previousId: "cfa-13173", riderName: "Undying Departed, Grenache", crestCardId: "cfa-13177", crestName: "Vampire Princess of Night Fog, Nightrose" },
  { cardId: "cfa-13188", previousId: "cfa-13187", riderName: "Happiness Collector", crestCardId: "cfa-13186", crestName: "Masked Magician, Harri" }
];
const catalog = loadCatalog();
const definition = id => {
  const value = catalog.find(card => String(card.id) === String(id));
  assert.ok(value, `catalog card ${id} exists`);
  return value;
};
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const instance = (cardDefinition, uid, playerId, extra = {}) => ({
  uid, cardId: String(cardDefinition.id), cardName: cardDefinition.name, type: cardDefinition.type || "Unit",
  grade: Number(cardDefinition.grade || 0), unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId,
  ...(cardDefinition.clan ? { clan: cardDefinition.clan, clans: cardDefinition.clans || [cardDefinition.clan] } : {}), ...extra
});

function fixture({ card = cards[0], side = "bot", eventType = "card.ridden", timingWindow = "normal-ride", riderPreviousLocation = "hand", previousCardId = card.previousId, targetUid, sourceUid, sourceControllerPlayerId, targetName, sourceName } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest-player" : "host-player";
  const riderDefinition = definition(card.cardId), previousDefinition = definition(previousCardId);
  const rider = instance(riderDefinition, `${side}-incoming-rider`, ownerId);
  const previousVanguard = instance(previousDefinition, `${side}-previous-vanguard`, ownerId);
  const drawn = instance(definition("cfa-3"), `${side}-drawn-card`, ownerId);
  const deckRemainder = instance(definition("cfa-4"), `${side}-deck-remainder`, ownerId);
  const opponentVanguard = instance(definition("cfa-3"), `${opponentSide}-vanguard`, opponentId);
  const owner = { playerId: ownerId, vanguard: rider, rear: [null, null, null, null, null], hand: [], deck: [deckRemainder, drawn], soul: [previousVanguard], drop: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null], hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const state = { matchId: "ride-crest-match", stateVersion: 7, eventSequence: 0, turn: 1, side, firstSide: side, phase: 2, players, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAttack: null };
  const ability = Engine.parseCardAbilitiesCached(riderDefinition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${card.cardId} has the reviewed ride/crest ability`);
  const event = Engine.createGameEvent(state, {
    eventId: `ride-${side}-${card.cardId}`, type: eventType, actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: sourceUid || rider.uid, sourceCardName: sourceName || riderDefinition.name,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: sourceControllerPlayerId || ownerId,
    cardInstanceId: sourceUid || rider.uid, subjectCardInstanceId: sourceUid || rider.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: sourceControllerPlayerId || ownerId,
    previousLocation: riderPreviousLocation, currentLocation: "vanguard", targetCardInstanceIds: [targetUid || previousVanguard.uid],
    targetCardName: targetName || previousDefinition.name, targetOwnerPlayerId: ownerId, targetControllerPlayerId: ownerId,
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow
  });
  const authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return { state, event, ability, side, owner, opponent, rider, previousVanguard, deckRemainder, ownerId, authUid, card, previousDefinition };
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, authUid = f.authUid, actionId = `ride-crest-${f.side}`) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.rider.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("the five exact catalog cards have one mandatory, independently represented AUTO", () => {
  for (const card of cards) {
    const catalogCard = definition(card.cardId), abilities = Engine.parseCardAbilitiesCached(catalogCard);
    assert.equal(abilities.length, 1, `${card.cardId} has one AUTO ability`);
    const ability = abilities[0];
    assert.equal(ability.id, `${card.cardId}:0`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.canDecline, false);
    assert.equal(ability.printedText, ability.definition.printedText);
    assert.ok(catalogCard.text.includes(ability.printedText));
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.trigger.eventType, "card.ridden");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetCardNameEquals, card.riderName);
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(ability.effects, [
      { op: "draw", count: 1 },
      { op: "create-crest", target: "controller", cardId: card.crestCardId, cardName: card.crestName }
    ]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player independently draw and receive the actual named Crest from their own ride", () => {
  for (const card of cards) for (const side of ["human", "bot"]) {
    const f = fixture({ card, side }), queued = discover(f);
    assert.equal(queued.queued.length, 1, `${card.cardId}/${side} prompt`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.rider.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const projectedOwner = Projection.projectForPlayer(f.state, f.ownerId);
    const projectedOpponent = Projection.projectForPlayer(f.state, f.opponent.playerId);
    assert.equal(projectedOwner.pendingAbility.side, side);
    assert.equal(projectedOpponent.pendingAbility, null);

    const result = resolve(f);
    assert.equal(result.ok, true, `${card.cardId}/${side}: ${result.reason}`);
    assert.deepEqual(f.owner.deck, [f.deckRemainder]);
    assert.equal(f.owner.hand[0].uid, `${side}-drawn-card`);
    assert.equal(f.owner.hand[0].ownerPlayerId, f.ownerId);
    assert.equal(f.owner.crests.length, 1);
    assert.equal(f.owner.crests[0].cardId, card.crestCardId);
    assert.equal(f.owner.crests[0].crestName, card.crestName);
    assert.equal(f.owner.crests[0].ownerPlayerId, f.ownerId);
    assert.equal(f.owner.crests[0].controllerPlayerId, f.ownerId);
    assert.equal(f.opponent.hand.length, 0);
    assert.equal(f.opponent.crests.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn", "card.created"]);
    assert.equal(result.events[1].cardInstanceId, f.owner.crests[0].uid);
    assert.equal(result.events[1].currentLocation, "crest");
  }
});

test("a different prior Vanguard, unrelated placement, wrong target instance, wrong rider, or wrong timing cannot trigger", () => {
  const wrongPrevious = fixture({ previousCardId: "cfa-3" });
  assert.equal(discover(wrongPrevious).queued.length, 0);
  assert.equal(discover(fixture({ eventType: "card.placed" })).queued.length, 0);
  assert.equal(discover(fixture({ targetUid: "another-card-instance" })).queued.length, 0);
  assert.equal(discover(fixture({ sourceUid: "another-card-instance" })).queued.length, 0);
  assert.equal(discover(fixture({ riderPreviousLocation: "vanguard" })).queued.length, 0);
  assert.equal(discover(fixture({ timingWindow: "stride" })).queued.length, 0);
  assert.equal(discover(fixture({ sourceControllerPlayerId: "opponent-player" })).queued.length, 0);
});

test("the joining player alone resolves the prompt, and stale ride state rejects atomically", () => {
  const joined = fixture({ side: "bot" });
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state);
  const forged = resolve(joined, seats.hostAuthUid);
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, "source-not-controlled");
  assert.equal(JSON.stringify(joined.state), before);

  const stale = fixture({ side: "bot" });
  assert.equal(discover(stale).queued.length, 1);
  const [oldVanguard] = stale.owner.soul.splice(0, 1);
  stale.owner.drop.push(oldVanguard);
  const staleBefore = JSON.stringify(stale.state);
  const rejected = resolve(stale);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ride-draw-crest-event-context-invalid");
  assert.equal(JSON.stringify(stale.state), staleBefore);
  assert.equal(stale.owner.hand.length, 0);
  assert.equal(stale.owner.crests.length, 0);
});

test("a crest with mismatched card identity is rejected and duplicate actions cannot replay the effect", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const pending = f.state.pendingAbility, bad = structuredClone(pending.ability);
  bad.definition.effects[1].cardId = "not-the-reviewed-crest";
  bad.effects[1].cardId = "not-the-reviewed-crest";
  assert.equal(Reducer.supportsServerAbilityEffects(bad), false);

  const result = resolve(f);
  assert.equal(result.ok, true, result.reason);
  assert.equal(discover(f).queued.length, 0, "a replayed ride event cannot queue a second draw or Crest");
  const after = JSON.stringify(f.state);
  const duplicate = resolve(f, f.authUid, `ride-crest-${f.side}`);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate-action");
  assert.equal(JSON.stringify(f.state), after);
  assert.equal(f.owner.hand.length, 1);
  assert.equal(f.owner.crests.length, 1);
});

