"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const ACT_IDS = ["cfa-12250", "cfa-12263", "cfa-12273", "cfa-12350", "cfa-12361", "cfa-12371"];
const AUTO_TARGETS = { "cfa-2025": "Seeker, Sacred Wingal", "cfa-2027": "Brawler, Skybeat Dragon", "cfa-2213": "Star-vader, Garnet Star Dragon", "cfa-2214": "Bluish Flame Liberator, Percival" };
const cardDef = id => catalog.find(card => String(card.id) === String(id));
const namedCardDef = name => catalog.find(card => String(card.name).toLowerCase() === String(name).toLowerCase());
function instance(definition, uid, playerId, extra = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", grade: Number(definition.grade), clan: definition.clan, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function player(playerId) { return { playerId, vanguard: null, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }; }

test("all ten same-name search abilities are restricted to their exact reviewed texts and effect programs", () => {
  for (const id of ACT_IDS) {
    const ability = Engine.parseCardAbilities(cardDef(id))[0];
    Engine.registerAbilityDefinitions([ability.definition]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    const tampered = structuredClone(ability);
    tampered.definition.effects[0].maximum = 2;
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, `${id} tampered target count`);
  }
  for (const [id, targetName] of Object.entries(AUTO_TARGETS)) {
    const ability = Engine.parseCardAbilities(cardDef(id))[0];
    const reviewed = Engine.getReviewedAbilityDefinitionsForCard(id);
    assert.ok(reviewed.some(definition => definition.id === ability.id), `${id} production trusted registry`);
    assert.equal(ability.definition.effects[0].cardName, targetName);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    const tampered = structuredClone(ability);
    tampered.definition.effects[0].cardName = "Different Card Name";
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, `${id} tampered named target`);
  }
});

test("named VC searches reject wrong source, wrong circle, and unpayable costs before creating prompts", () => {
  const sourceDefinition = cardDef("cfa-2025"), ability = Engine.parseCardAbilities(sourceDefinition)[0];
  const playerId = "host-player", source = instance(sourceDefinition, "strict-vc-source", playerId, { zone: "vanguard", circle: "vanguard" });
  const own = player(playerId), opponent = player("guest-player");
  own.vanguard = source;
  own.deck = [instance(namedCardDef(AUTO_TARGETS["cfa-2025"]), "strict-target", playerId, { zone: "deck" })];
  opponent.vanguard = instance(cardDef("cfa-3"), "strict-opponent-vg", opponent.playerId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "same-name-auto-strict", stateVersion: 1, side: "human", phase: 2, turn: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players: { human: own, bot: opponent } };
  const makeEvent = (overrides = {}) => Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "call", timingWindow: "call", ...overrides });
  assert.equal(Reducer.discoverAutoTriggers(state, [makeEvent({ cardInstanceId: "different-copy", subjectCardInstanceId: "different-copy" })], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(state, [makeEvent({ eventId: "wrong-circle", currentLocation: "rear-guard", circle: "rear-guard" })], Engine).queued.length, 0);
  own.damage = [];
  own.soul = [];
  assert.equal(Reducer.discoverAutoTriggers(state, [makeEvent({ eventId: "unpayable" })], Engine).queued.length, 0);
  assert.equal(state.pendingAbility, undefined);
  assert.equal(own.hand.length, 0);
  assert.equal(own.deck.length, 1);
  assert.equal(ability.trigger.circles[0], "vanguard");
});

test("host and joining player can each resolve the once-per-turn ACT using their own resources and same-name target", () => {
  for (const side of ["human", "bot"]) {
    const playerId = side === "human" ? "host-player" : "guest-player", otherSide = side === "human" ? "bot" : "human";
    const definition = cardDef(ACT_IDS[0]), ability = Engine.parseCardAbilities(definition)[0];
    Engine.registerAbilityDefinitions([ability.definition]);
    const source = instance(definition, `act-source-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
    const duplicate = instance(definition, `act-target-${side}`, playerId, { zone: "deck" });
    const cb = instance(cardDef("cfa-3"), `act-cb-${side}`, playerId, { faceDown: false, zone: "damage" });
    const own = player(playerId), opponent = player(otherSide === "human" ? "host-player" : "guest-player");
    own.vanguard = source; own.deck = [duplicate]; own.damage = [cb];
    opponent.vanguard = instance(cardDef("cfa-3"), `opponent-vg-${side}`, opponent.playerId, { zone: "vanguard", circle: "vanguard" });
    const state = { matchId: "same-name-act", stateVersion: 1, side, phase: 4, turn: 2, processedActionIds: [], pendingAbilities: [], players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent } };
    const response = Reducer.applyManualAbilityActivation(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `act-${side}`, expectedStateVersion: 1, payload: { sourceCardInstanceId: source.uid, abilityId: ability.id, selection: { costSelections: { cb: [cb.uid], sb: [], discard: [], reveal: [] }, effectUid: duplicate.uid } } }, seats, Engine);
    assert.equal(response.ok, true, response.reason);
    assert.ok(own.hand.some(card => card.uid === duplicate.uid));
    assert.equal(source.turnPowerBoost, 10000);
    assert.equal(own.damage[0].faceDown, true);
    assert.equal((own.usedAbilities || []).length, 1);
    const before = JSON.stringify(state);
    const repeat = Reducer.applyManualAbilityActivation(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `act-repeat-${side}`, expectedStateVersion: state.stateVersion, payload: { sourceCardInstanceId: source.uid, abilityId: ability.id, selection: { costSelections: { cb: [], sb: [], discard: [], reveal: [] }, effectUid: null } } }, seats, Engine);
    assert.equal(repeat.ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test("the four named VC AUTO searches prompt and resolve privately for either controller", () => {
  for (const [sourceId, targetName] of Object.entries(AUTO_TARGETS)) for (const side of ["human", "bot"]) {
    const playerId = side === "human" ? "host-player" : "guest-player", otherSide = side === "human" ? "bot" : "human";
    const sourceDefinition = cardDef(sourceId), ability = Engine.parseCardAbilities(sourceDefinition)[0];
    Engine.registerAbilityDefinitions([ability.definition]);
    const targetDefinition = namedCardDef(targetName);
    assert.ok(targetDefinition, `real catalog target ${targetName}`);
    const source = instance(sourceDefinition, `auto-source-${sourceId}-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
    const target = instance(targetDefinition, `auto-target-${sourceId}-${side}`, playerId, { zone: "deck" });
    const cb = instance(cardDef("cfa-3"), `auto-cb-${sourceId}-${side}`, playerId, { faceDown: false, zone: "damage" });
    const sb = instance(cardDef("cfa-3"), `auto-sb-${sourceId}-${side}`, playerId, { zone: "soul" });
    const own = player(playerId), opponent = player(otherSide === "human" ? "host-player" : "guest-player");
    own.vanguard = source; own.deck = [target]; own.damage = [cb]; own.soul = [sb];
    opponent.vanguard = instance(cardDef("cfa-3"), `auto-opponent-vg-${sourceId}-${side}`, opponent.playerId, { zone: "vanguard", circle: "vanguard" });
    const state = { matchId: "same-name-auto", stateVersion: 1, side, phase: 2, turn: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent } };
    const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "call", timingWindow: "call" });
    const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(discovered.queued.length, 1, `${sourceId} ${side}`);
    assert.equal(state.pendingAbility.side, side);
    assert.equal(state.pendingAbility.instance.uid, source.uid);
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 0);
    const result = Reducer.applyAbilityDecision(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `auto-${sourceId}-${side}`, expectedStateVersion: state.stateVersion, payload: { accept: true, selection: { instanceUid: source.uid, abilityId: ability.id, effectUid: target.uid, costSelections: { cb: [cb.uid], sb: [sb.uid], discard: [], reveal: [] } } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.ok(own.hand.some(card => card.uid === target.uid));
    assert.equal(own.damage[0].faceDown, true);
    assert.equal(own.soul.length, 0);
    const forgedState = { ...state, pendingAbility: { ...state.pendingAbility, side, instance: source, ability, triggerControllerPlayerId: playerId, eventContext: { event: "place", eventId: event.eventId, gameEvent: event } } };
    assert.equal(Reducer.applyAbilityDecision(forgedState, { actorAuthUid: side === "human" ? "auth-guest" : "auth-host", actionId: `auto-forged-${sourceId}-${side}`, expectedStateVersion: forgedState.stateVersion, payload: { accept: true, selection: { instanceUid: source.uid, abilityId: ability.id, effectUid: null, costSelections: { cb: [cb.uid], sb: [sb.uid], discard: [], reveal: [] } } } }, seats, Engine).ok, false);
  }
});

