"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-11778", "cfa-11780"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId, side = "human") {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `catalog is missing ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: card.grade };
  const deck = [0, 1].map(index => ({ uid: `top-${cardId}-${side}-${index}`, cardId: `soul-charge-card-${index}`, ownerPlayerId: playerId, controllerPlayerId: playerId }));
  const activePlayer = { playerId, rear: [source], vanguard: null, deck, hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const emptyPlayer = { playerId: opponentId, rear: [], vanguard: null, deck: [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const state = { matchId: "rc-placement-optional-soul-charge-two", stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players: side === "human" ? { human: activePlayer, bot: emptyPlayer } : { human: emptyPlayer, bot: activePlayer } };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "normal-call"
  });
  return { state, event, ability, source, deck, side, playerId, opponentSide };
}

function decide(f, accept, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid,
    actionId: `${accept ? "accept" : "decline"}-${f.source.uid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("both exact local card records compile the optional RC-only Soul Charge 2 effect while remaining text-unverified", () => {
  for (const id of IDS) {
    const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === id)).find(item => item.id === `${id}:0`);
    assert.equal(ability?.definition?.source?.patternId, "auto-rc-placement-optional-soul-charge-two-v1");
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "soul-charge", count: 2 }]);
    assert.equal(ability.definition.source.officialTextVerified, false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player independently accept or decline their own placement trigger", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const accepted = fixture(id, side);
    const queued = Reducer.discoverAutoTriggers(accepted.state, [accepted.event], Engine);
    assert.equal(queued.queued.length, 1, JSON.stringify(queued));
    assert.equal(accepted.state.pendingAbility.side, side);
    const expectedSoulUids = accepted.deck.slice().reverse().map(card => card.uid);
    assert.equal(decide(accepted, true).ok, true);
    assert.deepEqual(accepted.state.players[side].soul.map(card => card.uid), expectedSoulUids);
    assert.equal(accepted.state.players[accepted.opponentSide].soul.length, 0);
    assert.equal(Reducer.discoverAutoTriggers(accepted.state, [accepted.event], Engine).queued.length, 0);

    const declined = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
    assert.equal(decide(declined, false).ok, true);
    assert.equal(declined.state.players[side].soul.length, 0);
    assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 0);
  }
});

test("wrong-circle and wrong-source events do not prompt, and the host cannot resolve the joiner's trigger", () => {
  const wrongCircle = fixture(IDS[0], "bot");
  const guardianEvent = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "guardian-placement", currentLocation: "guardian", circle: "guardian" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [guardianEvent], Engine).queued.length, 0);

  const wrongSource = fixture(IDS[1], "bot");
  const unrelatedEvent = Engine.createGameEvent(wrongSource.state, { ...wrongSource.event, eventId: "unrelated-placement", sourceCardInstanceId: "other-card", cardInstanceId: "other-card", subjectCardInstanceId: "other-card" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelatedEvent], Engine).queued.length, 0);

  const joined = fixture(IDS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(joined.state, [joined.event], Engine).queued.length, 1);
  const forged = decide(joined, true, seats.hostAuthUid);
  assert.equal(forged.ok, false);
  assert.equal(joined.state.players.bot.soul.length, 0);
  assert.equal(joined.state.players.human.soul.length, 0);
});
