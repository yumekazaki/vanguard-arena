"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-vc-another-clan-rearguard-placement-soul-charge-one-v1";
const CARDS = [
  ["cfa-479", "Dark Irregulars"],
  ["cfa-763", "Tachikaze"],
  ["cfa-809", "Pale Moon"]
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const authFor = side => side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
const cardFor = id => catalog.find(card => card.id === id);
const abilityFor = id => Engine.parseCardAbilitiesCached(cardFor(id)).find(ability => ability.definition?.source?.patternId === PATTERN);
const emptyPlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), deck: [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });

function fixture({ cardId = CARDS[0][0], side = "human", subjectClan = null, circle = "rear-left" } = {}) {
  const card = cardFor(cardId), clan = CARDS.find(([id]) => id === cardId)[1], ability = abilityFor(cardId);
  const playerId = side === "human" ? "player-host" : "player-guest", opponentSide = side === "human" ? "bot" : "human";
  const source = { uid: `source-${side}`, cardId, cardName: card.name, type: "Unit", grade: Number(card.grade), clan, clans: [clan], ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
  const placed = { uid: `placed-${side}`, cardId: `test-${subjectClan || clan}`, cardName: "Placed ally", type: "Unit", grade: 1, clan: subjectClan || clan, clans: [subjectClan || clan], ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
  const top = { uid: `top-${side}`, cardId: "test-top", cardName: "Top card", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const own = emptyPlayer(playerId), opponent = emptyPlayer(opponentSide === "human" ? "player-host" : "player-guest");
  own.vanguard = source;
  if (/^(?:rear-|accel-|rear\d)/.test(circle)) own.rear[0] = placed;
  own.deck.push(top);
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: `vc-placement-soul-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: placed.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: placed.uid, subjectCardInstanceId: placed.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: circle, circle, phase: "main", timingWindow: "normal-call"
  });
  return { state, event, card, ability, source, placed, top, own, side, playerId, opponentSide };
}

function decide(f, accept = true, actorAuthUid = authFor(f.side)) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `${f.state.matchId}-${accept ? "accept" : "decline"}-${f.state.stateVersion}`,
    matchId: f.state.matchId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("the three catalog abilities share the exact optional VC clan-placement Soul Charge definition", () => {
  for (const [cardId, clan] of CARDS) {
    const card = cardFor(cardId), ability = abilityFor(cardId);
    assert.ok(card && ability, cardId);
    assert.equal(ability.printedText, `AUTO [VC]: When another of your «${clan}» is placed on RC, you may Soul Charge 1.`);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "card.placed", subject: "any", circles: ["rear-guard"], excludeSourceAsSubject: true, subjectControllerRelation: "source-controller" });
    assert.deepEqual(ability.conditions, [{ type: "event-subject-has-clan", value: clan }]);
    assert.deepEqual(ability.definition.effects, [{ op: "soul-charge", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the correct Vanguard controller alone resolves the optional effect in host and joining seats", () => {
  for (const [cardId] of CARDS) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const forged = decide(f, true, authFor(f.opponentSide));
    assert.equal(forged.ok, false, `${cardId}/${side}: opponent cannot resolve it`);
    const accepted = decide(f);
    assert.equal(accepted.ok, true, accepted.reason);
    assert.equal(f.own.soul[0]?.uid, f.top.uid);
    assert.equal(f.own.deck.length, 0);
    assert.equal(f.state.players[f.opponentSide].soul.length, 0);
  }
});

test("wrong clan, wrong circle, and the source itself do not satisfy the trigger", () => {
  const wrongClan = fixture({ subjectClan: "Kagero" });
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);

  const wrongCircle = fixture({ circle: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

  const self = fixture();
  self.own.rear[0] = self.source;
  const selfEvent = Engine.createGameEvent(self.state, { ...self.event, eventId: "source-was-placed", sourceCardInstanceId: self.source.uid, cardInstanceId: self.source.uid, subjectCardInstanceId: self.source.uid, sourceControllerPlayerId: self.playerId, subjectControllerPlayerId: self.playerId, currentLocation: "rear-left", circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(self.state, [selfEvent], Engine).queued.length, 0);
});

test("a matching clan placed under the opponent's control does not trigger this player's Vanguard", () => {
  const f = fixture(), opponentId = "player-guest";
  const opponentUnit = { uid: "opponent-placed", cardId: "opponent-unit", cardName: "Opponent unit", type: "Unit", grade: 1, clan: "Dark Irregulars", clans: ["Dark Irregulars"], ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true };
  f.state.players.bot.rear[0] = opponentUnit;
  const event = Engine.createGameEvent(f.state, {
    type: "card.placed", actingPlayerId: opponentId, turnPlayerId: opponentId,
    sourceCardInstanceId: opponentUnit.uid, sourceOwnerPlayerId: opponentId, sourceControllerPlayerId: opponentId,
    cardInstanceId: opponentUnit.uid, subjectCardInstanceId: opponentUnit.uid, subjectOwnerPlayerId: opponentId, subjectControllerPlayerId: opponentId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "normal-call"
  });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0);
});

test("declining the optional trigger consumes that event without charging Soul", () => {
  const f = fixture();
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const declined = decide(f, false);
  assert.equal(declined.ok, true, declined.reason);
  assert.equal(f.own.soul.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
});
