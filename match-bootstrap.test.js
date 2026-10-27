"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Bootstrap = require("./match-bootstrap.js");
const Worker = require("./supabase/functions/match-worker/worker-core.js");

const catalog = {};
catalog.starter = { id: "starter", name: "Starter Unit", grade: 0, type: "Unit", text: "" };
for (let index = 1; index <= 9; index++) catalog[`unit-${index}`] = { id: `unit-${index}`, name: `Unit ${index}`, grade: 1, type: "Unit", text: "" };
catalog["unit-1"].clan = "Shadow Paladin";
for (let index = 1; index <= 4; index++) catalog[`trigger-${index}`] = { id: `trigger-${index}`, name: `Trigger ${index}`, grade: 0, type: "Trigger", trigger: "Critical", text: "" };
for (let index = 1; index <= 5; index++) catalog[`g-unit-${index}`] = { id: `g-unit-${index}`, name: `G Unit ${index}`, grade: 4, type: "G Unit", text: "" };
const cardById = id => catalog[id] || null;
const legalDeck = () => ({
  name: "Legal 50 Card Deck", starterCardId: "starter",
  cards: { starter: 1, "unit-1": 4, "unit-2": 4, "unit-3": 4, "unit-4": 4, "unit-5": 4, "unit-6": 4, "unit-7": 4, "unit-8": 4, "unit-9": 1, "trigger-1": 4, "trigger-2": 4, "trigger-3": 4, "trigger-4": 4 }
});
function options(overrides = {}) {
  let id = 0, card = 0;
  return {
    hostDeck: legalDeck(), guestDeck: legalDeck(), hostAuthUid: "auth-host", guestAuthUid: "auth-guest",
    hostName: "Host", guestName: "Guest", cardById, engine: Engine,
    idFactory: () => `generated-id-${++id}`, uidFactory: () => `generated-card-${++card}`, random: () => 0.42,
    ...overrides
  };
}

test("initial server state validates both submitted legal decks and creates unique owner-scoped card instances", () => {
  const built = Bootstrap.createInitialMatchState(options());
  assert.equal(built.ok, true);
  const state = built.state;
  assert.deepEqual(state.authoritySeats, { hostSide: "human", guestSide: "bot" });
  assert.equal(state.players.human.human, true);
  assert.equal(state.players.bot.human, false);
  for (const side of ["human", "bot"]) {
    const player = state.players[side];
    assert.equal(player.hand.length, 5);
    assert.equal(player.deck.length, 44);
    assert.equal(player.vanguard.cardId, "starter");
    assert.equal(player.vanguard.grade, 0);
    assert.ok([...player.hand, ...player.deck].every(card => Number.isInteger(card.grade) && card.grade >= 0));
    const instances = [player.vanguard, ...player.hand, ...player.deck];
    assert.equal(new Set(instances.map(card => card.uid)).size, 50);
    assert.ok(instances.every(card => card.ownerPlayerId === player.playerId && card.controllerPlayerId === player.playerId));
    const typedUnit = instances.find(card => card.cardId === "unit-1");
    assert.equal(typedUnit.type, "Unit");
    assert.equal(typedUnit.clan, "Shadow Paladin");
    assert.equal(typedUnit.hasAbilities, false);
  }
  assert.deepEqual(Worker.validateCanonicalMatchState(state, 0, {
    hostSide: "human", guestSide: "bot", hostAuthUid: "auth-host", guestAuthUid: "auth-guest"
  }), { ok: true, cardCount: 100 });
});

test("bootstrap shuffles only after separating the selected starter and preserves G-deck counts", () => {
  const deck = legalDeck(); deck.cards["g-unit-1"] = 1; deck.cards["g-unit-2"] = 1;
  const built = Bootstrap.createInitialMatchState(options({ hostDeck: deck, random: () => 0.5 }));
  assert.equal(built.ok, true);
  const host = built.state.players.human;
  assert.equal(host.gDeck.length, 2);
  assert.ok(host.gDeck.every(card => card.cardId.startsWith("g-unit-")));
  assert.ok(host.gDeck.every(card => card.gDeckCard === true && card.grade === 4));
  assert.ok(host.gDeck.every(card => card.faceUp === false));
  assert.equal(host.hand.length + host.deck.length + 1, 50);
});

test("bootstrap preserves the trusted Ultimate Stride cost restriction on G-deck instances", () => {
  const previousText = catalog["g-unit-1"].text;
  catalog["g-unit-1"].text = "Ultimate Stride - discard a card with the same name as a card in your heart.";
  try {
    const deck = legalDeck(); deck.cards["g-unit-1"] = 1;
    const built = Bootstrap.createInitialMatchState(options({ hostDeck: deck }));
    assert.equal(built.ok, true);
    const stride = built.state.players.human.gDeck.find(card => card.cardId === "g-unit-1");
    assert.equal(stride.ultimateStride, true);
    assert.equal(stride.faceUp, false);
  } finally { catalog["g-unit-1"].text = previousText; }
});

test("bootstrap stamps only printed Limit Break 4 abilities onto authoritative card instances", () => {
  const oldText = catalog["unit-2"].text;
  catalog["unit-2"].text = "AUTO [VC] Limit Break 4 (This ability is active if you have four or more damage): This unit gets power +5000.";
  try {
    const built = Bootstrap.createInitialMatchState(options());
    assert.equal(built.ok, true);
    const instances = [built.state.players.human.vanguard, ...built.state.players.human.hand, ...built.state.players.human.deck]
      .filter(instance => instance.cardId === "unit-2");
    assert.ok(instances.length > 0);
    assert.ok(instances.every(instance => instance.hasLimitBreak4 === true));
    assert.equal(built.state.players.human.hand.concat(built.state.players.human.deck).some(instance => instance.cardId === "unit-1" && instance.hasLimitBreak4), false);
  } finally { catalog["unit-2"].text = oldText; }
});

test("server deck validation rejects invalid quantities, unknown cards, wrong trigger counts, and illegal starters", () => {
  const valid = legalDeck();
  assert.equal(Bootstrap.validateDecklist(valid, cardById, Engine).ok, true);

  const invalidQuantity = legalDeck(); invalidQuantity.cards.starter = 1.5;
  assert.equal(Bootstrap.validateDecklist(invalidQuantity, cardById, Engine).reason, "invalid-card-count");

  const unknown = legalDeck(); unknown.cards.unknown = 1; unknown.cards["unit-9"] = 0;
  assert.equal(Bootstrap.validateDecklist(unknown, cardById, Engine).reason, "unknown-card");

  const wrongTriggers = legalDeck(); wrongTriggers.cards["trigger-4"] = 3; wrongTriggers.cards["unit-9"] = 2;
  assert.equal(Bootstrap.validateDecklist(wrongTriggers, cardById, Engine).reason, "main-deck-must-have-16-triggers");

  const badStarter = legalDeck(); badStarter.starterCardId = "unit-1";
  assert.equal(Bootstrap.validateDecklist(badStarter, cardById, Engine).reason, "invalid-starter");
});

test("server deck validation enforces current builder limits for card names, heals, and G-deck size", () => {
  const originalName = catalog["unit-2"].name; catalog["unit-2"].name = catalog["unit-1"].name;
  assert.equal(Bootstrap.validateDecklist(legalDeck(), cardById, Engine).reason, "same-name-limit-exceeded");
  catalog["unit-2"].name = originalName;

  const healViolation = legalDeck();
  for (let index = 1; index <= 4; index++) catalog[`heal-${index}`] = { id: `heal-${index}`, name: `Heal ${index}`, grade: 0, type: "Trigger", trigger: "Heal", text: "" };
  healViolation.cards["trigger-1"] = 0; healViolation.cards["trigger-2"] = 0; healViolation.cards["trigger-3"] = 0; healViolation.cards["trigger-4"] = 0;
  for (let index = 1; index <= 4; index++) healViolation.cards[`heal-${index}`] = 4;
  assert.equal(Bootstrap.validateDecklist(healViolation, cardById, Engine).reason, "deck-restriction-exceeded");

  const oversizedGDeck = legalDeck(); for (let index = 1; index <= 5; index++) oversizedGDeck.cards[`g-unit-${index}`] = 4;
  assert.equal(Bootstrap.validateDecklist(oversizedGDeck, cardById, Engine).reason, "g-deck-exceeds-16");
});

test("state initialization rejects duplicate IDs from a broken secure ID source", () => {
  let calls = 0;
  assert.throws(() => Bootstrap.createInitialMatchState(options({ idFactory: () => (++calls === 1 ? "same" : "same") })), /distinct nonempty strings/);
});
