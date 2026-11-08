"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CARD_CASES = [
  { cardId: "cfa-2", abilityId: "cfa-2:0" },
  { cardId: "cfa-394", abilityId: "cfa-394:0" }
];

function card(id) { return catalog.find(item => String(item.id) === id); }
function inst(id, uid, playerId, extra = {}) {
  const definition = card(id) || {};
  return {
    uid,
    cardId: id,
    cardName: definition.name || id,
    type: definition.type || "Unit",
    grade: Number(definition.grade || 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function fixture(cardCase, ownerPlayerId, circle = "rear-guard", vanguardClan = "Oracle Think Tank") {
  const ownerSide = ownerPlayerId === "player-host" ? "human" : "bot";
  const opponentPlayerId = ownerPlayerId === "player-host" ? "player-guest" : "player-host";
  const sourceCircle = circle === "vanguard" ? "vanguard" : "rear-left";
  const sourceZone = circle === "vanguard" ? "vanguard" : "rear-guard";
  const source = inst(cardCase.cardId, cardCase.cardId + "-placed", ownerPlayerId, { zone: sourceZone, circle: sourceCircle });
  const oldCopy = inst(cardCase.cardId, cardCase.cardId + "-old-copy", ownerPlayerId, { zone: "rear-guard", circle: "rear-right" });
  const vanguard = circle === "vanguard" ? source : inst("test-oracle-vanguard", ownerPlayerId + "-oracle-vanguard", ownerPlayerId, {
    zone: "vanguard", circle: "vanguard", clan: vanguardClan, clans: [vanguardClan]
  });
  const top = inst("test-top", ownerPlayerId + "-deck-top", ownerPlayerId);
  const bottom = inst("test-bottom", ownerPlayerId + "-deck-bottom", ownerPlayerId);
  const own = {
    playerId: ownerPlayerId, vanguard, rear: circle === "vanguard" ? [oldCopy, null, null, null, null] : [oldCopy, source, null, null, null], hand: [], drop: [], soul: [], damage: [],
    deck: [bottom, top], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponent = {
    playerId: opponentPlayerId,
    vanguard: inst("test-opponent-vanguard", opponentPlayerId + "-vanguard", opponentPlayerId, { zone: "vanguard", circle: "vanguard", grade: 3 }),
    rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: []
  };
  const players = ownerSide === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: "oracle-order-" + cardCase.cardId + "-" + ownerSide + "-" + circle, stateVersion: 1, eventSequence: 0,
    processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], phase: 1, turn: 1, side: ownerSide, players };
  const ability = Engine.parseCardAbilities(card(cardCase.cardId)).find(item => item.id === cardCase.abilityId);
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerPlayerId, turnPlayerId: ownerPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerPlayerId, sourceControllerPlayerId: ownerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectControllerPlayerId: ownerPlayerId,
    previousLocation: "hand", currentLocation: sourceCircle, circle, phase: "main", timingWindow: "effect-placement"
  });
  return { ability, source, oldCopy, top, bottom, own, state, event, ownerPlayerId, ownerSide,
    actorAuthUid: ownerPlayerId === "player-host" ? seats.hostAuthUid : seats.guestAuthUid };
}

function decide(f, destination) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.actorAuthUid,
    actionId: f.state.matchId + "-" + destination,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: {
      instanceUid: f.source.uid,
      abilityId: f.ability.id,
      effectUid: f.top.uid,
      deckDestination: destination
    } }
  }, seats, Engine);
}

test("official Oracle placement AUTOs resolve the exact top card for either seated player and either circle", async t => {
  for (const cardCase of CARD_CASES) for (const ownerPlayerId of ["player-host", "player-guest"]) {
    for (const circle of ["vanguard", "rear-guard"]) for (const destination of ["top", "bottom"]) {
      await t.test(cardCase.abilityId + " " + ownerPlayerId + " " + circle + " " + destination, () => {
        const f = fixture(cardCase, ownerPlayerId, circle);
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
        assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
        const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
        assert.equal(discovery.queued.length, 1);
        assert.equal(discovery.queued[0].instance.uid, f.source.uid);
        assert.equal(discovery.queued[0].triggerControllerPlayerId, ownerPlayerId);
        assert.equal(discovery.queued[0].side, f.ownerSide);
        assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "the same event cannot queue the ability twice");
        const result = decide(f, destination);
        assert.equal(result.ok, true, result.reason);
        assert.equal(result.resolvedAbilityId, cardCase.abilityId);
        assert.deepEqual(f.own.deck.map(item => item.uid), destination === "top"
          ? [f.bottom.uid, f.top.uid]
          : [f.top.uid, f.bottom.uid]);
      });
    }
  }
});

test("Oracle top-card AUTO rejects a false clan condition, unrelated placement, wrong circle, or altered source text", () => {
  const cardCase = CARD_CASES[0];
  const wrongClan = fixture(cardCase, "player-guest", "rear-guard", "Kagero");
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);

  const unrelated = fixture(cardCase, "player-guest");
  const unrelatedEvent = { ...unrelated.event, sourceCardInstanceId: "unrelated-instance", cardInstanceId: "unrelated-instance", subjectCardInstanceId: "unrelated-instance" };
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelatedEvent], Engine).queued.length, 0);

  const wrongCircle = fixture(cardCase, "player-guest");
  const guardianPlacement = { ...wrongCircle.event, circle: "guardian", currentLocation: "guardian" };
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [guardianPlacement], Engine).queued.length, 0);

  const altered = fixture(CARD_CASES[1], "player-host");
  altered.ability.definition = structuredClone(altered.ability.definition);
  altered.ability.definition.printedText += " Altered.";
  assert.equal(Reducer.supportsServerAbilityEffects(altered.ability), false);
});
