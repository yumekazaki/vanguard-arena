"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-13489", "cfa-13624"];
const TEXT = 'AUTO: When this unit is placed on RC, COST [Energy Blast 3], search your deck for up to one "Masque of Hydragrum", reveal it and put it into hand, and shuffle the deck.';
const PATTERN = "auto-rc-placement-energy-blast-masque-search-v1";
const SEARCH_EFFECT = { op: "search-deck-same-name-to-hand", target: "controller", maximum: 1, cardName: "Masque of Hydragrum" };
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
let sequence = 0;

function card(cardId, uid, playerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId}`);
  return { uid, cardId: String(cardId), cardName: definition.name, name: definition.name, type: definition.type,
    grade: Number(definition.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: /unit/i.test(String(definition.type || "")), ...extra };
}

function fixture(cardId = IDS[0], side = "human", { energy = 6, generator = true } = {}) {
  const n = ++sequence;
  const ownId = side === "human" ? "player-host" : "player-guest";
  const enemyId = side === "human" ? "player-guest" : "player-host";
  const source = card(cardId, `source-${n}`, ownId);
  const masque = card("cfa-10829", `masque-${n}`, ownId);
  const wrong = card("cfa-20", `wrong-${n}`, ownId);
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [],
    damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], crests: [], energy: 0, energySpentThisTurn: 0 });
  const players = { human: player("player-host"), bot: player("player-guest") };
  const own = players[side], enemy = players[side === "human" ? "bot" : "human"];
  own.vanguard = card("cfa-20", `vanguard-${n}`, ownId);
  enemy.vanguard = card("cfa-20", `enemy-vanguard-${n}`, enemyId);
  own.rear[0] = source;
  own.deck = [masque, wrong, card("cfa-21", `filler-${n}`, ownId)];
  own.energy = energy;
  if (generator) own.crests.push(card("cfa-12245", `generator-${n}`, ownId));
  const state = { matchId: `energy-masque-${n}`, stateVersion: 1, eventSequence: 0, processedActionIds: [],
    processedAbilityTriggers: [], processedEventIds: [], turn: 2, side, phase: 2, pendingAbility: null,
    pendingAbilities: [], pendingTrigger: null, players };
  const ability = Engine.parseCardAbilitiesCached(CATALOG.get(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled ${cardId}:0`);
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId,
    subjectControllerPlayerId: ownId, previousLocation: "hand", currentLocation: "rear-left",
    circle: "rear-left", timingWindow: "placement" });
  return { ability, cardId, side, ownId, enemyId, source, masque, wrong, own, enemy, state, event };
}

function authFor(side) { return side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid; }
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decision(f, effectUid = f.masque.uid, actorAuthUid = authFor(f.side)) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.side}-${f.cardId}-${sequence}-${effectUid || "none"}`,
    expectedStateVersion: f.state.stateVersion, payload: { accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid } } }, SEATS, Engine);
}
function withShuffleCounter(run) {
  const crypto = globalThis.crypto, original = crypto.getRandomValues;
  let calls = 0;
  crypto.getRandomValues = sample => { calls++; return original.call(crypto, sample); };
  try { return { result: run(), calls }; }
  finally { crypto.getRandomValues = original; }
}

test("the two official Dragontree Wretch AUTOs retain exact placement, Energy Blast, search, and official source metadata", () => {
  for (const cardId of IDS) {
    const ability = Engine.parseCardAbilitiesCached(CATALOG.get(cardId)).find(item => item.id === `${cardId}:0`);
    const official = cardId === "cfa-13489" ? "DZ-BT06/036EN" : "DZ-BT06/022EN";
    assert.equal(ability.printedText, TEXT);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.cardNumber, official);
    assert.equal(ability.definition.source.officialTextVerified, true);
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "energy-blast", count: 3 }]);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.effects, [SEARCH_EFFECT]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player resolve only their own exact source placement, pay their own Energy Blast, and receive the revealed card", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    const queued = discover(f);
    assert.equal(queued.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(queued.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side === "human" ? "bot" : "human").pendingAbility, null);
    const { result, calls } = withShuffleCounter(() => decision(f));
    assert.equal(result.ok, true, `${cardId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.own.energy, 3);
    assert.equal(f.own.energySpentThisTurn, 3);
    assert.equal(f.enemy.energy, 0);
    assert.ok(f.own.hand.some(item => item.uid === f.masque.uid));
    assert.ok(!f.own.deck.some(item => item.uid === f.masque.uid));
    assert.equal(f.own.deck.length, 2);
    assert.ok(calls > 0, "the authoritative deck search shuffles after adding the card");
    assert.ok(f.enemy.hand.length === 0);
    assert.ok(result.events.some(event => event.type === "card.revealed" && event.cardInstanceId === f.masque.uid));
  }
});

test("the up-to-one search may select no card and still pays, shuffles, and resolves", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const { result, calls } = withShuffleCounter(() => decision(f, null));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.own.energy, 3);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.deck.length, 3);
  assert.ok(calls > 0, "the deck is shuffled even when no card is selected");
  assert.equal(result.events.some(event => event.type === "card.revealed"), false);
});

test("unavailable Energy Blast or no Energy Generator prevents the AUTO from becoming pending", () => {
  for (const options of [{ energy: 2 }, { energy: 6, generator: false }]) {
    const f = fixture(IDS[0], "human", options);
    const before = { energy: f.own.energy, deck: f.own.deck.map(item => item.uid), hand: [...f.own.hand] };
    const result = discover(f);
    assert.equal(result.queued.length, 0);
    assert.equal(f.own.energy, before.energy);
    assert.deepEqual(f.own.deck.map(item => item.uid), before.deck);
    assert.deepEqual(f.own.hand, before.hand);
  }
});

test("unrelated placement, wrong circle, forged actor, invalid target, and duplicate event cannot resolve this AUTO", () => {
  const unrelated = fixture();
  const otherSource = card("cfa-21", `unrelated-${sequence}`, unrelated.ownId);
  const wrongSourceEvent = Engine.createGameEvent(unrelated.state, { ...unrelated.event,
    eventId: undefined, sourceCardInstanceId: otherSource.uid, sourceOwnerPlayerId: unrelated.ownId,
    sourceControllerPlayerId: unrelated.ownId, cardInstanceId: otherSource.uid,
    subjectCardInstanceId: otherSource.uid, subjectOwnerPlayerId: unrelated.ownId,
    subjectControllerPlayerId: unrelated.ownId });
  assert.equal(discover(unrelated, wrongSourceEvent).queued.length, 0);

  const wrongCircle = fixture();
  const invalidCircleEvent = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event,
    eventId: undefined, currentLocation: "vanguard", circle: "vanguard" });
  assert.equal(discover(wrongCircle, invalidCircleEvent).queued.length, 0);

  const forged = fixture();
  assert.equal(discover(forged).queued.length, 1);
  const before = structuredClone(forged.state);
  const forgedResult = decision(forged, forged.masque.uid, SEATS.hostAuthUid === authFor(forged.side) ? SEATS.guestAuthUid : SEATS.hostAuthUid);
  assert.equal(forgedResult.ok, false);
  assert.equal(JSON.stringify(forged.state), JSON.stringify(before));

  const badTarget = fixture();
  assert.equal(discover(badTarget).queued.length, 1);
  const untouched = { energy: badTarget.own.energy, deck: badTarget.own.deck.map(item => item.uid), hand: [...badTarget.own.hand] };
  const badResult = decision(badTarget, badTarget.wrong.uid);
  assert.equal(badResult.ok, false);
  assert.equal(badTarget.own.energy, untouched.energy);
  assert.deepEqual(badTarget.own.deck.map(item => item.uid), untouched.deck);
  assert.deepEqual(badTarget.own.hand, untouched.hand);

  const duplicate = fixture();
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(discover(duplicate).queued.length, 0);
  assert.equal(duplicate.own.energy, 6);
});
