"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-CANDIDATE-320008F1-0005.js");
Engine.registerAbilityDefinitions(contribution);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const abilityIds = [
  "cfa-13994:0", "cfa-13994:1", "cfa-13994:2",
  "cfa-8315:0", "cfa-8315:1",
  "cfa-8316:0", "cfa-8316:1",
  "cfa-9074:0", "cfa-9074:1"
];
const expectedTexts = [
  'AUTO: When this card is put in the order zone, choose a grade 3 card with "Orfist" in its card name from your ride deck, and you may reveal it. If you revealed a card, or you have a grade 3 or greater vanguard with "Orfist" in its card name, draw a card.',
  'CONT [Order Zone]: If your order zone only has World cards, the following effects are active according to the number of cards in your order zone.\n• 1 card - Your World becomes Dark Night.\n• 2 or more cards - Your World becomes Abyssal Dark Night.',
  'ACT [Order Zone]: If you have a grade 3 or greater vanguard with "Orfist" in its card name, and this card was not put into the order zone this turn, COST [Soul Blast 1 & rest this card], call a Shadow Army token to RC, and change this card’s name to "Casting a Shadow in the Murky Night" until end of turn.\n\n(SHIFT + left click to call tokens.)',
  "AUTO: When this card is put into order zone, draw a card.",
  'CONT [Order Zone]: If your order zone only has World cards, the following effects are active according to the number of cards in your order zone.\n• 1 card - Your World becomes Dark Night.\n• 2 or more cards - Your World becomes Abyssal Dark Night.',
  'AUTO: When this card is put in the order zone, choose one of your opponent’s front row rear-guards, and retire it.',
  'CONT [Order Zone]: If your order zone only has World cards, the following effects are active according to the number of cards in your order zone.\n• 1 card - Your World becomes Dark Night.\n• 2 or more cards - Your World becomes Abyssal Dark Night.',
  'CONT [Order Zone]: If your order zone only has World cards, the following effects are active according to the number of cards in your order zone.\n• 1 card - Your World becomes Dark Night.\n• 2 or more cards - Your World becomes Abyssal Dark Night.',
  "AUTO [Order Zone]: When your Shadow Army token is placed, that placed unit gets power +5000 until end of turn."
];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PRINTED = "AUTO: When this card is put in the order zone, choose one of your opponent’s front row rear-guards, and retire it.";
const PATTERN = "auto-order-zone-placement-retire-opponent-front-rearguard-v1";
const RETIRE_PROBE = {
  id: "cfa-8316:0", cardId: "cfa-8316", kind: "AUTO", printedText: PRINTED,
  requiredLocation: ["order"],
  trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["order"] },
  conditions: [], conditionsReviewed: true, costs: [], costsReviewed: true, choicesReviewed: true, optional: false,
  source: { dataset: "local audit probe", patternId: PATTERN },
  effects: [{ op: "retire-target", target: "chosen", targetFilter: { controller: "opponent", zone: "rear-guard", row: "front" } }]
};
// Test-only probe: this is deliberately not exported as a production contribution.
Engine.registerAbilityDefinitions([RETIRE_PROBE]);

function instance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: definition?.name || String(cardId),
    type: definition?.type || "Unit", grade: Number(definition?.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function fixture(side = "human", { noTarget = false } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "host-player" : "guest-player";
  const source = instance("cfa-8316", `source-${side}`, ownerId, { zone: "order", circle: "order" });
  const target = noTarget ? null : instance("cfa-2", `opponent-front-${side}`, otherId, { zone: "rear-guard", circle: "rear-left" });
  const blankPlayer = playerId => ({
    playerId, vanguard: instance("cfa-3", `vg-${playerId}`, playerId, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), orders: [], hand: [], soul: [], drop: [], damage: [], deck: [], bind: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  });
  const players = { [side]: blankPlayer(ownerId), [otherSide]: blankPlayer(otherId) };
  players[side].orders.push(source);
  if (target) players[otherSide].rear[0] = target;
  const state = {
    matchId: `order-zone-retire-${side}`, stateVersion: 1, turn: 4, phase: "main", side,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "order", circle: "order",
    phase: "main", timingWindow: "order-zone-placement"
  });
  const ability = Engine.parseCardAbilities(cards.get("cfa-8316")).find(item => item.id === "cfa-8316:0");
  return { state, side, ownerId, otherSide, source, target, event, ability };
}

function decide(f, targetUid, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth,
    actionId: `order-zone-retire-${f.side}-${targetUid || "none"}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-8316:0", targetUid } }
  }, seats, Engine);
}

test("all nine printed ability blocks are accounted for without merging distinct abilities", () => {
  const all = [];
  const printedText = [];
  for (const cardId of ["cfa-13994", "cfa-8315", "cfa-8316", "cfa-9074"]) {
    const card = cards.get(cardId);
    assert.ok(card, `catalog card ${cardId}`);
    const parsed = Engine.parseCardAbilities(card);
    assert.equal(parsed.length, cardId === "cfa-13994" ? 3 : 2, cardId);
    all.push(...parsed.map(item => item.id));
    printedText.push(...parsed.map(item => item.printedText));
  }
  assert.deepEqual(all, abilityIds);
  assert.deepEqual(printedText, expectedTexts);
  assert.deepEqual(contribution, [], "no incomplete ability definition is exported");
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, ["cfa-8315:0"]);
  assert.equal(contribution.unsupportedSiblings.length, 8);
  assert.ok(contribution.unsupportedSiblings.every(item => abilityIds.includes(item.abilityId)));

  const existing = Engine.parseCardAbilities(cards.get("cfa-8315")).find(item => item.id === "cfa-8315:0");
  assert.equal(existing.definition?.source?.patternId, "auto-order-zone-placement-draw-v1");
  assert.equal(Reducer.supportsServerAbilityEffects(existing), true);
});

test("audit probe confirms the placement AUTO and existing handler support when a legal target exists", () => {
  const f = fixture();
  assert.equal(f.ability.printedText, PRINTED);
  assert.equal(f.ability.kind, "AUTO");
  assert.deepEqual(f.ability.requiredLocation, ["order"]);
  assert.deepEqual(f.ability.trigger, { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["order"] });
  assert.equal(f.ability.canDecline, false);
  assert.deepEqual(f.ability.definition.effects, [{
    op: "retire-target", target: "chosen",
    targetFilter: { controller: "opponent", zone: "rear-guard", row: "front" }
  }]);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);

  const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(found.queued.length, 1, JSON.stringify(found.skipped));
  assert.equal(f.state.pendingAbility.side, f.side);
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  assert.equal(f.state.pendingAbility.ability.id, "cfa-8316:0");
});

test("the exact owner/controller (host or joining player) resolves and retires only the selected opponent front Rear-Guard", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    const result = decide(f, f.target.uid);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.ok(f.state.players[f.otherSide].drop.some(card => card.uid === f.target.uid));
    assert.equal(f.state.players[f.otherSide].rear[0], null);
    assert.deepEqual(result.events.map(event => event.type), ["card.retired"]);
  }
});

test("audit blocker: zero legal targets must no-op by Comprehensive Rules, but reducer currently strands the mandatory AUTO", () => {
  const f = fixture("human", { noTarget: true });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  const result = decide(f, null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing-ability-target");
  assert.equal(JSON.stringify(f.state), before, "rejected resolution leaves the prompt pending");
  assert.match(contribution.unsupportedSiblings.find(item => item.abilityId === "cfa-8316:0").blocker,
    /11\.8\.4\.1\.2-11\.8\.4\.1\.3/);
});

test("wrong circle, unrelated source instance, stale target, friendly target, and back-row target are rejected", () => {
  const wrongCircle = fixture();
  const rearEvent = Object.freeze({ ...wrongCircle.event, eventId: "wrong-circle", currentLocation: "rear-guard", circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [rearEvent], Engine).queued.length, 0);

  const wrongInstance = fixture();
  const otherCopyEvent = Object.freeze({ ...wrongInstance.event, eventId: "other-copy", sourceCardInstanceId: "other-copy", cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" });
  assert.equal(Reducer.discoverAutoTriggers(wrongInstance.state, [otherCopyEvent], Engine).queued.length, 0);

  const f = fixture();
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const ownRearGuard = instance("cfa-2", "friendly-target", f.ownerId, { zone: "rear-guard", circle: "rear-right" });
  f.state.players[f.side].rear[1] = ownRearGuard;
  for (const targetUid of ["stale-target", ownRearGuard.uid]) {
    const before = JSON.stringify(f.state);
    const rejected = decide(f, targetUid);
    assert.equal(rejected.ok, false, `${targetUid}: ${rejected.reason}`);
    assert.equal(JSON.stringify(f.state), before, "invalid selection must not partially mutate the match");
  }

  const backRow = fixture();
  backRow.state.players[backRow.otherSide].rear[2] = backRow.state.players[backRow.otherSide].rear[0];
  backRow.state.players[backRow.otherSide].rear[0] = null;
  assert.equal(Reducer.discoverAutoTriggers(backRow.state, [backRow.event], Engine).queued.length, 1);
  const before = JSON.stringify(backRow.state);
  const rejected = decide(backRow, backRow.target.uid);
  assert.equal(rejected.ok, false, rejected.reason);
  assert.equal(JSON.stringify(backRow.state), before);
});

test("the host cannot answer the joining player's private mandatory ability prompt", () => {
  const f = fixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(f.state.pendingAbility.side, "bot");
  const before = JSON.stringify(f.state);
  const result = decide(f, f.target.uid, seats.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);
});
