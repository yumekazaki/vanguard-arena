"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const IDS = ["cfa-11526", "cfa-11545", "cfa-11558", "cfa-11607", "cfa-11671"];
const PATTERN = "auto-rc-main-phase-race-top-three-memory-v1";
const TEXT = "AUTO: When this unit is placed on RC during your main phase, if you have a <Quintuplet> vanguard, look at the top three cards of your deck, choose up to one <Quintuplet> from among them, put it into memory, and shuffle the deck.";

function definition(cardId) { return catalog.find(card => String(card.id) === String(cardId)); }
function card(cardId, uid, playerId, extra = {}) {
  const printed = definition(cardId);
  return { uid, cardId: String(cardId), cardName: printed?.name, type: printed?.type, grade: printed?.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture({ cardId = IDS[0], side = "human", quintupletVanguard = true } = {}) {
  const otherSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = otherSide === "human" ? "host-player" : "guest-player";
  const source = card(cardId, `source-${cardId}-${side}`, playerId);
  const vanguard = card(quintupletVanguard ? "cfa-11526" : "cfa-3", `vanguard-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const chosen = card("cfa-11545", `chosen-${side}`, playerId);
  const ineligible = card("cfa-3", `ineligible-${side}`, playerId);
  const other = card("cfa-11607", `other-${side}`, playerId);
  const emptyPlayer = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [],
    deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].vanguard = vanguard;
  players[side].rear[0] = source;
  players[side].deck = [other, ineligible, chosen];
  players[otherSide].vanguard = card("cfa-3", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: `quintuplet-memory-${side}`, stateVersion: 1, turn: 3, phase: 4, side, eventSequence: 0,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "main-phase-placement"
  });
  const ability = Engine.parseCardAbilitiesCached(definition(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `AUTO ability for ${cardId}`);
  return { state, event, ability, source, chosen, ineligible, other, side, otherSide, playerId,
    authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function respond(f, selection = {}, authUid = f.authUid, actionId = `resolve-${f.state.matchId}`) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } }
  }, seats, Engine);
}

test("the five printed AUTOs share one exact reusable definition without absorbing their CONT abilities", () => {
  for (const cardId of IDS) {
    const parsed = Engine.parseCardAbilitiesCached(definition(cardId));
    const auto = parsed.find(item => item.id === `${cardId}:0`);
    assert.equal(auto.printedText, TEXT, cardId);
    assert.equal(auto.definition.source.patternId, PATTERN, cardId);
    assert.deepEqual(auto.requiredLocation, [], cardId, "the printed AUTO has no separate source-location restriction at resolution");
    assert.equal(auto.canDecline, false, cardId);
    assert.equal(auto.definition.effects[0].op, "put-top-up-to-one-filtered-in-order-zone", cardId);
    assert.ok(parsed.some(item => item.kind === "CONT"), `${cardId} keeps its different printed CONT independent`);
    assert.equal(Reducer.supportsServerAbilityEffects(auto), true, cardId);
  }

  const synthetic = Engine.parseCardAbilities({ id: "future-quintuplet-family-card", text: TEXT })[0];
  assert.equal(synthetic.definition.source.patternId, PATTERN, "same exact text compiles for new IDs without an allowlist");
  assert.equal(Reducer.supportsServerAbilityEffects(synthetic), true);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...synthetic, definition: { ...synthetic.definition, printedText: `${TEXT} Extra.` } }), false);
});

test("host and joining player privately receive and independently resolve their own placement AUTO", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ cardId: IDS[1], side });
    assert.equal(discover(f).queued.length, 1, `${side} queues exact source ability`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.otherSide).pendingAbility, null);
    assert.equal(respond(f, { effectUid: f.chosen.uid }).ok, true);
    assert.equal(f.state.players[side].orders.length, 1);
    assert.equal(f.state.players[side].orders[0].uid, f.chosen.uid);
    assert.equal(f.state.players[side].orders[0].zone, "order");
    assert.equal(f.state.players[side].orders[0].faceDown, false);
    assert.deepEqual(new Set(f.state.players[side].deck.map(item => item.uid)), new Set([f.ineligible.uid, f.other.uid]));
    assert.equal(f.state.players[f.otherSide].orders.length, 0);
  }
});

test("zero-card choice is legal, still shuffles, and leaves all looked cards in the deck", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(respond(f).ok, true);
  assert.equal(f.state.players[f.side].orders.length, 0);
  assert.deepEqual(new Set(f.state.players[f.side].deck.map(item => item.uid)), new Set([f.chosen.uid, f.ineligible.uid, f.other.uid]));

  let shuffleCalls = 0;
  const player = { playerId: "owner", deck: [f.other, f.ineligible, f.chosen], orders: [] };
  const effect = { op: "put-top-up-to-one-filtered-in-order-zone", target: "controller", lookCount: 3, maximum: 1,
    filter: { race: "Quintuplet" }, destination: "memory", shuffle: true };
  const result = Engine.resolveEffectProgram([effect], Engine.EFFECT_HANDLERS, { player, actorPlayerId: "owner", effectUid: null,
    cardDefinitionForInstance: item => ({ ...definition(item.cardId), race: "", races: definition(item.cardId)?.races || [] }), shuffleDeck: () => { shuffleCalls++; } });
  assert.equal(result.ok, true);
  assert.equal(shuffleCalls, 1);
});

test("wrong circle, source instance, phase, or turn player cannot trigger; false Vanguard requirement is suppressed", () => {
  const changes = [
    { currentLocation: "vanguard", circle: "vanguard" },
    { cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" },
    { phase: "battle" },
    { turnPlayerId: "opponent-player" }
  ];
  for (const change of changes) {
    const f = fixture();
    const event = Object.freeze({ ...f.event, ...change, eventId: `${f.event.eventId}-${Object.keys(change)[0]}` });
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(change));
  }
  const wrongVanguard = fixture({ quintupletVanguard: false });
  const falseAtTrigger = discover(wrongVanguard);
  assert.equal(falseAtTrigger.queued.length, 1, "a When-event AUTO triggers even when its following if requirement is false");
  assert.equal(wrongVanguard.state.pendingAbility, null, "the mandatory no-op must not prompt the player");
  assert.equal(wrongVanguard.state.pendingAbilities.length, 0, "a false requirement with no higher-priority resolution is consumed silently");
  assert.ok(falseAtTrigger.skipped.some(item => item.reason === "quintuplet-vanguard-requirement-false-noop"));
  assert.equal(wrongVanguard.state.players.human.orders.length, 0);
  const wrongStatePhase = fixture();
  wrongStatePhase.state.phase = 5;
  assert.equal(discover(wrongStatePhase).queued.length, 0, "current authoritative phase is also checked");
});

test("mandatory AUTO requirement is rechecked at resolution and a false result consumes as a no-op", () => {
  const f = fixture({ quintupletVanguard: true });
  assert.equal(discover(f).queued.length, 1);
  f.state.players[f.side].vanguard = card("cfa-3", `changed-vanguard-${f.side}`, f.playerId, { zone: "vanguard", circle: "vanguard" });
  const result = respond(f, { effectUid: f.chosen.uid });
  assert.equal(result.ok, true, "mandatory AUTO resolves as a no-op when its if requirement is false at resolution");
  assert.equal(result.resolution, "requirement-not-met-no-op");
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.state.players[f.side].orders.length, 0);
  assert.deepEqual(new Set(f.state.players[f.side].deck.map(item => item.uid)), new Set([f.chosen.uid, f.ineligible.uid, f.other.uid]));
});

test("false-at-trigger AUTO waits silently behind a higher-priority pending ability and becomes resolvable if its condition turns true", () => {
  const f = fixture({ quintupletVanguard: false });
  const higherPriority = { side: f.side, instance: f.state.players[f.side].vanguard,
    ability: { id: "higher-priority-auto", kind: "AUTO" }, triggerControllerPlayerId: f.playerId,
    eventContext: { eventId: "higher-priority-event", turnPlayerId: f.playerId } };
  f.state.pendingAbility = higherPriority;
  const discovery = discover(f);
  assert.equal(discovery.queued.length, 1);
  assert.equal(f.state.pendingAbility, higherPriority, "the active higher-priority AUTO stays first");
  assert.equal(f.state.pendingAbilities.length, 1);
  assert.equal(f.state.pendingAbilities[0].suppressPromptUntilRequirementMet, true);
  assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.side).pendingAbilities.length, 0, "false-if AUTO is hidden from the controller while waiting");

  // Resolving the earlier AUTO changes the Vanguard before the queued AUTO's if check.
  f.state.pendingAbility = null;
  f.state.players[f.side].vanguard = card(IDS[2], `new-quintuplet-vanguard-${f.side}`, f.playerId, { zone: "vanguard", circle: "vanguard" });
  Reducer.discoverAutoTriggers(f.state, [], Engine);
  assert.ok(f.state.pendingAbility, "the now-true mandatory AUTO is promoted for resolution");
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  assert.equal(f.state.pendingAbility.suppressPromptUntilRequirementMet, false);
  assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.side).pendingAbility.instance.uid, f.source.uid);
  assert.equal(respond(f, { effectUid: f.chosen.uid }).ok, true);
  assert.equal(f.state.players[f.side].orders[0].uid, f.chosen.uid);
});

test("invalid or stale choices are rejected without partially moving cards; duplicated events and replies resolve once", () => {
  const invalid = fixture();
  const first = discover(invalid);
  assert.equal(first.queued.length, 1);
  const before = invalid.state.players[invalid.side].deck.map(item => item.uid);
  const rejected = respond(invalid, { effectUid: invalid.ineligible.uid });
  assert.equal(rejected.ok, false);
  assert.deepEqual(invalid.state.players[invalid.side].deck.map(item => item.uid), before);
  assert.equal(invalid.state.players[invalid.side].orders.length, 0);

  const duplicate = fixture({ side: "bot" });
  const twice = Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event, duplicate.event], Engine);
  assert.equal(twice.queued.length, 1);
  const accepted = respond(duplicate, { effectUid: duplicate.chosen.uid });
  assert.equal(accepted.ok, true);
  assert.equal(respond(duplicate, { effectUid: duplicate.chosen.uid }, duplicate.authUid, `resolve-${duplicate.state.matchId}`).reason, "duplicate-action");
  assert.equal(duplicate.state.players.bot.orders.filter(item => item.uid === duplicate.chosen.uid).length, 1);
  const forgedHost = fixture({ side: "bot" });
  discover(forgedHost);
  assert.equal(respond(forgedHost, { effectUid: forgedHost.chosen.uid }, seats.hostAuthUid).ok, false, "host cannot resolve joining player's private choice");
});
