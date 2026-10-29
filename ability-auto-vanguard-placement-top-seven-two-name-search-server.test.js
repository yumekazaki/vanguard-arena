"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-vanguard-placement-top-seven-two-name-search-v1";
const CARD_IDS = ["cfa-7878", "cfa-7970", "cfa-8012", "cfa-8090", "cfa-8143"];
const catalog = loadCatalog();
const definitions = require("./ability-definitions.js").filter(item => item.source?.patternId === PATTERN);

function makeState(side, cardId) {
  const hostId = "host-player", guestId = "guest-player";
  const ids = { human: hostId, bot: guestId };
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const state = { matchId: `match-${side}-${cardId}`, side, turn: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players: { human: player(hostId), bot: player(guestId) } };
  const source = { uid: `source-${side}-${cardId}`, cardId, ownerPlayerId: ids[side], controllerPlayerId: ids[side], zone: "vanguard", circle: "vanguard", faceUp: true };
  state.players[side].vanguard = source;
  state.players[side === "human" ? "bot" : "human"].vanguard = { uid: `other-${side}`, cardId: "cfa-31", ownerPlayerId: ids[side === "human" ? "bot" : "human"], controllerPlayerId: ids[side === "human" ? "bot" : "human"], zone: "vanguard", circle: "vanguard" };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ids[side], turnPlayerId: ids[side], sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ids[side], sourceControllerPlayerId: ids[side], cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ids[side], subjectControllerPlayerId: ids[side], previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "ride", timingWindow: "ride" });
  return { state, source, event, ids };
}

test("the five real Vanguard placement abilities have exact reviewed text and server support", () => {
  assert.equal(definitions.length, 5);
  for (const cardId of CARD_IDS) {
    const card = catalog.find(item => String(item.id) === cardId);
    const definition = definitions.find(item => item.cardId === cardId);
    assert.ok(card, `catalog card ${cardId}`);
    assert.ok(definition, `reviewed definition ${cardId}`);
    const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:0`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.equal(ability.canDecline, false, "the AUTO resolves; choosing zero search targets remains legal");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the controller of the exact newly placed Vanguard receives one private prompt", () => {
  for (const side of ["human", "bot"]) {
    const { state, source, event, ids } = makeState(side, CARD_IDS[0]);
    const first = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(first.queued.length, 1);
    assert.equal(first.queued[0].side, side);
    assert.equal(first.queued[0].instance.uid, source.uid);
    assert.equal(first.queued[0].triggerControllerPlayerId, ids[side]);
    assert.equal(state.pendingAbility?.side, side);
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 0, "duplicate event cannot prompt twice");
  }
});

test("a different instance, a Rear-Guard placement, or a source no longer on VC cannot trigger", () => {
  const wrongInstance = makeState("human", CARD_IDS[0]);
  const forged = Engine.createGameEvent(wrongInstance.state, { type: "card.placed", eventId: "forged-subject", actingPlayerId: wrongInstance.ids.human, turnPlayerId: wrongInstance.ids.human, sourceCardInstanceId: "some-other-instance", sourceControllerPlayerId: wrongInstance.ids.human, cardInstanceId: "some-other-instance", subjectCardInstanceId: "some-other-instance", subjectControllerPlayerId: wrongInstance.ids.human, previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongInstance.state, [forged], Engine).queued.length, 0);

  const wrongCircle = makeState("human", CARD_IDS[0]);
  const rearEvent = Engine.createGameEvent(wrongCircle.state, { type: "card.placed", eventId: "wrong-circle", actingPlayerId: wrongCircle.ids.human, turnPlayerId: wrongCircle.ids.human, sourceCardInstanceId: wrongCircle.source.uid, sourceControllerPlayerId: wrongCircle.ids.human, cardInstanceId: wrongCircle.source.uid, subjectCardInstanceId: wrongCircle.source.uid, subjectControllerPlayerId: wrongCircle.ids.human, previousLocation: "hand", currentLocation: "rear-guard", circle: "rear-guard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [rearEvent], Engine).queued.length, 0);

  const moved = makeState("human", CARD_IDS[0]);
  moved.state.players.human.vanguard = null;
  moved.state.players.human.hand.push(moved.source);
  assert.equal(Reducer.discoverAutoTriggers(moved.state, [moved.event], Engine).queued.length, 0);
});

test("the reusable top-seven effect allows zero selection and only accepts the exact names among the top seven", () => {
  const ability = Engine.parseCardAbilities(catalog.find(item => item.id === CARD_IDS[0])).find(item => item.id === `${CARD_IDS[0]}:0`);
  const effect = ability.definition.effects;
  const targetName = effect[0].filter.cardNamesAny[0];
  const targetDefinition = catalog.find(item => item.name === targetName);
  assert.ok(targetDefinition, `target card ${targetName} is in the catalog`);
  const makeInstance = (uid, cardId) => ({ uid, cardId, ownerPlayerId: "host-player", controllerPlayerId: "host-player" });
  const target = makeInstance("target-top-seven", targetDefinition.id);
  const filler = Array.from({ length: 7 }, (_, index) => makeInstance(`filler-${index}`, "cfa-31"));
  const outsideTop = makeInstance("outside-top-seven", targetDefinition.id);
  const cardMap = new Map(catalog.map(card => [String(card.id), card]));
  let shuffles = 0;
  const makeContext = deck => ({ player: { playerId: "host-player", deck, hand: [] }, side: "human", cardDefinitionForInstance: instance => cardMap.get(String(instance.cardId)), shuffleDeck: () => { shuffles++; }, emitEvent: () => {} });

  const noChoiceContext = makeContext([...filler, target]);
  const noChoice = Engine.resolveEffectProgram(effect, Engine.EFFECT_HANDLERS, noChoiceContext);
  assert.equal(noChoice.ok, true);
  assert.equal(noChoiceContext.player.hand.length, 0);
  assert.equal(noChoiceContext.player.deck.length, 8);
  assert.equal(shuffles, 1);

  const selectedContext = makeContext([...filler, target]);
  const selected = Engine.resolveEffectProgram(effect, Engine.EFFECT_HANDLERS, { ...selectedContext, effectUid: target.uid });
  assert.equal(selected.ok, true);
  assert.deepEqual(selectedContext.player.hand.map(card => card.uid), [target.uid]);
  assert.equal(selectedContext.player.deck.length, 7);

  const invalidContext = makeContext([target, ...filler, outsideTop]);
  const invalid = Engine.resolveEffectProgram(effect, Engine.EFFECT_HANDLERS, { ...invalidContext, effectUid: target.uid });
  assert.equal(invalid.ok, false, "a matching card outside the top seven is not a legal selection");
  assert.equal(invalidContext.player.hand.length, 0, "invalid choice is atomic");
});
