"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const trustedDefinitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(trustedDefinitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-counter-blast-same-name-search-power-v1";
const IDS = ["cfa-12250", "cfa-12263", "cfa-12273", "cfa-12350", "cfa-12361", "cfa-12371"];
const TEXT = "ACT [VC] 1/Turn: COST [Counter Blast 1], search your deck for up to one card with the same card name as this unit, reveal it and put it into hand, shuffle the deck, and this unit gets power +10000 until end of turn.";
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function inst(card, uid, playerId) {
  return { uid, cardId: String(card.id), cardName: card.name, name: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId,
    grade: Number(card.grade), type: card.type, unitCard: /unit/i.test(String(card.type)), shield: Number(card.shield || 0) };
}
function setup(cardId, side = "bot", deckCount = 24) {
  const card = cards.get(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const source = inst(card, `source-${cardId}-${side}`, playerId);
  const twin = inst(card, `same-name-${cardId}-${side}`, playerId);
  const wrongCard = catalog.find(entry => entry.name !== card.name && /unit/i.test(String(entry.type)));
  assert.ok(wrongCard);
  const wrong = inst(wrongCard, `wrong-name-${side}`, playerId);
  const filler = catalog.filter(entry => entry.name !== card.name && entry.name !== wrongCard.name && /unit/i.test(String(entry.type))).slice(0, deckCount - 2);
  const deck = [twin, wrong, ...filler.map((entry, index) => inst(entry, `filler-${side}-${index}`, playerId))];
  const owner = { playerId, vanguard: source, rear: Array(5).fill(null), soul: [], drop: [], damage: [{ uid: `cb-${side}`, cardId: "cfa-1", faceDown: false, ownerPlayerId: playerId, controllerPlayerId: playerId }], hand: [], deck, bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], usedAbilities: [] };
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const opponentCard = cards.get("cfa-3");
  const opponent = { playerId: opponentId, vanguard: inst(opponentCard, `opponent-${side}`, opponentId), rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], usedAbilities: [] };
  const state = { matchId: "act-same-name-search", stateVersion: 7, processedActionIds: [], turn: 4, phase: 4, side,
    players: side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
  return { state, owner, opponent, source, twin, wrong, card, side, authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}
function activate(f, opts = {}) {
  const cb = opts.cb === undefined ? [`cb-${f.side}`] : opts.cb;
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: opts.actorAuthUid || f.authUid,
    actionId: opts.actionId || `activate-${f.side}-${f.source.cardId}`,
    expectedStateVersion: opts.version === undefined ? f.state.stateVersion : opts.version,
    payload: { sourceCardInstanceId: f.source.uid, abilityId: `${f.source.cardId}:0`,
      selection: { costSelections: { cb, sb: [], discard: [], reveal: [] }, effectUid: opts.effectUid === undefined ? f.twin.uid : opts.effectUid } }
  }, seats, Engine);
}

test("six reviewed same-name search ACTs are present in the trusted registry with exact validated definitions", () => {
  for (const cardId of IDS) {
    const card = cards.get(cardId);
    assert.ok(card, cardId);
    const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:0`);
    assert.ok(ability, cardId);
    assert.equal(ability.printedText, TEXT, cardId);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === `${cardId}:0`);
    assert.ok(trusted, `${cardId}:0 trusted registry entry`);
    assert.equal(trusted.source.patternId, PATTERN);
    assert.equal(trusted.printedText, TEXT);
    assert.deepEqual(trusted.requiredLocation, ["vanguard"]);
    assert.deepEqual(trusted.costs, [{ type: "counter-blast", count: 1 }]);
    assert.deepEqual(trusted.effects.map(step => step.op), ["search-deck-same-name-to-hand", "modify-power"]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("each host and joining player can activate their own ability and resolve exact-name search, reveal, shuffle, and power", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) {
    const f = setup(cardId, side);
    const beforeIds = f.owner.deck.map(card => card.uid).sort();
    const result = activate(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.ok(f.owner.hand.some(card => card.uid === f.twin.uid));
    assert.ok(f.owner.deck.some(card => card.uid === f.wrong.uid));
    assert.equal(f.owner.deck.length, beforeIds.length - 1);
    assert.equal(f.source.turnPowerBoost, 10000);
    assert.equal(f.owner.damage[0].faceDown, true);
    assert.equal(f.opponent.hand.length, 0);
    assert.ok((result.events || []).some(event => event.type === "card.revealed" && event.cardInstanceId === f.twin.uid));
  }
});

test("choosing no card still shuffles and resolves the +10000 power effect", () => {
  const f = setup("cfa-12250", "human", 32);
  const before = [...f.owner.deck].map(card => card.uid).sort();
  const cryptoObject = globalThis.crypto;
  const original = cryptoObject.getRandomValues;
  let randomCalls = 0;
  cryptoObject.getRandomValues = sample => { randomCalls++; sample[0] = 0; return sample; };
  let result;
  try { result = activate(f, { effectUid: null }); }
  finally { cryptoObject.getRandomValues = original; }
  assert.equal(result.ok, true, result.reason);
  assert.ok(randomCalls >= 1, "authoritative reducer shuffled despite no selected card");
  assert.deepEqual(f.owner.deck.map(card => card.uid).sort(), before);
  assert.equal(f.owner.hand.length, 0);
  assert.equal(f.source.turnPowerBoost, 10000);
  assert.equal(f.owner.damage[0].faceDown, true);
});

test("Counter Blast and once-per-turn are authoritative and reject repeated activation atomically", () => {
  const f = setup("cfa-12263", "bot");
  f.owner.damage[0].faceDown = true;
  let before = JSON.stringify(f.state);
  let result = activate(f);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);

  f.owner.damage[0].faceDown = false;
  result = activate(f, { actionId: "first-legal" });
  assert.equal(result.ok, true, result.reason);
  before = JSON.stringify(f.state);
  result = activate(f, { actionId: "second-distinct", effectUid: null });
  assert.equal(result.ok, false);
  assert.match(result.reason, /once|used|activation/);
  assert.equal(JSON.stringify(f.state), before);
});

test("mismatched card name, wrong circle, forged actor, replay, and tampered definitions are rejected", () => {
  const wrongName = setup("cfa-12273", "bot");
  const snapshotWrong = JSON.stringify(wrongName.state);
  let result = activate(wrongName, { effectUid: wrongName.wrong.uid });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(wrongName.state), snapshotWrong);

  const wrongCircle = setup("cfa-12350", "bot");
  wrongCircle.owner.vanguard = null;
  wrongCircle.owner.rear[0] = wrongCircle.source;
  wrongCircle.source.zone = "rear-guard";
  wrongCircle.source.circle = "rear-left";
  const snapshotCircle = JSON.stringify(wrongCircle.state);
  result = activate(wrongCircle);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(wrongCircle.state), snapshotCircle);

  const forged = setup("cfa-12361", "bot");
  const snapshotForged = JSON.stringify(forged.state);
  result = activate(forged, { actorAuthUid: seats.hostAuthUid });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(forged.state), snapshotForged);

  const replay = setup("cfa-12371", "human");
  result = activate(replay, { actionId: "one-request" });
  assert.equal(result.ok, true, result.reason);
  const snapshotReplay = JSON.stringify(replay.state);
  result = activate(replay, { actionId: "one-request", version: 7 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /duplicate|stale/);
  assert.equal(JSON.stringify(replay.state), snapshotReplay);

  const ability = Engine.parseCardAbilities(cards.get("cfa-12250")).find(item => item.id === "cfa-12250:0");
  const tampered = structuredClone(ability);
  tampered.definition.effects[1].amount = 5000;
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});
