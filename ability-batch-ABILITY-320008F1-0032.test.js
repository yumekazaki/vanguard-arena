"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const definitions = require("./ability-contributions/batch-ABILITY-320008F1-0032.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerAbilityDefinitions(definitions);

const FAMILY = "cont-rc-gc-opponent-check-trigger-power-shield-v1";
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const expected = [
  ["cfa-10888:0", "D-SS05/015EN"],
  ["cfa-10899:0", "D-SS05/006EN"],
  ["cfa-10904:0", "D-SS05/005EN"]
];

function getAbility(id) {
  const [cardId] = id.split(":");
  const card = cards.get(cardId);
  assert.ok(card, `real catalog card exists: ${cardId}`);
  return Engine.parseCardAbilities(card).find(ability => ability.id === id);
}

test("contributes only the three official dual-circle CONTs, preserving exact text and source references", () => {
  assert.deepEqual(definitions.map(definition => definition.id).sort(), expected.map(([id]) => id).sort());

  for (const [id, cardNumber] of expected) {
    const ability = getAbility(id);
    const definition = definitions.find(item => item.id === id);
    assert.ok(ability, `catalog ability exists: ${id}`);
    assert.equal(ability.kind, "CONT");
    assert.equal(definition.kind, "CONT");
    assert.equal(definition.cardId, id.split(":")[0]);
    assert.equal(definition.printedText, ability.printedText);
    assert.equal(definition.source.patternId, FAMILY);
    assert.equal(definition.source.dataset, "Bushiroad official card list");
    assert.equal(definition.source.officialCardNumber, cardNumber);
    assert.match(definition.source.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/\?cardno=/);
    assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(definition.cardId).find(item => item.id === id), definition);
    assert.deepEqual(definition.requiredLocation, ["rear-guard", "guardian"]);
    assert.deepEqual(definition.effects, [
      { op: "continuous-power", target: "source", amount: 10000, duration: "continuous", location: "rear-guard", condition: { op: "opponent-trigger-revealed-this-turn" } },
      { op: "continuous-shield", target: "source", amount: 10000, duration: "continuous", location: "guardian", condition: { op: "opponent-trigger-revealed-this-turn" } }
    ]);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${id} remains a continuous ability`);
  }
});

test("trigger-check fact belongs only to the checker’s opponent for both online seats and clears at turn end", () => {
  const players = {
    host: { playerId: "host-player", opponentTriggerRevealedThisTurn: false },
    guest: { playerId: "guest-player", opponentTriggerRevealedThisTurn: false }
  };

  assert.equal(Engine.recordOpponentTriggerCheck(players, "host-player", "critical", "drive"), true);
  assert.equal(players.host.opponentTriggerRevealedThisTurn, false);
  assert.equal(players.guest.opponentTriggerRevealedThisTurn, true);
  assert.equal(Engine.recordOpponentTriggerCheck(players, "guest-player", "heal", "damage"), true);
  assert.equal(players.guest.opponentTriggerRevealedThisTurn, true, "a later own trigger does not erase the earlier qualifying opponent trigger");
  assert.equal(players.host.opponentTriggerRevealedThisTurn, true);

  assert.equal(Engine.recordOpponentTriggerCheck(players, "host-player", "critical", "trigger"), false);
  assert.equal(Engine.recordOpponentTriggerCheck(players, "host-player", "", "drive"), false, "a check without a trigger unit cannot set the fact");
  assert.equal(Engine.recordOpponentTriggerCheck(players, "unknown-player", "critical", "drive"), false);
  assert.equal(Engine.clearOpponentTriggerFacts(players), true);
  assert.equal(players.host.opponentTriggerRevealedThisTurn, false);
  assert.equal(players.guest.opponentTriggerRevealedThisTurn, false);
});

test("all three CONTs apply power only on RC and shield only on GC while the opponent-trigger fact is active", () => {
  for (const [id] of expected) {
    const ability = getAbility(id);
    for (const location of ["rear-guard", "guardian", "vanguard", "hand", "soul"]) {
      const context = { location, opponentTriggerRevealedThisTurn: true };
      const power = Engine.evaluateContinuousEffects([ability], context).power;
      const shield = Engine.evaluateContinuousShieldEffects([ability], context).shield;
      assert.equal(power, location === "rear-guard" ? 10000 : 0, `${id} power at ${location}`);
      assert.equal(shield, location === "guardian" ? 10000 : 0, `${id} shield at ${location}`);
    }

    assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentTriggerRevealedThisTurn: false }).power, 0, `${id} without opponent trigger`);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentTriggerRevealedThisTurn: false }).shield, 0, `${id} without opponent trigger`);
  }
});

test("the separate Drajeweled ride restriction and Cannot Be Ridden keyword remain non-manual and strictly checked", () => {
  const drajeweled = getAbility("cfa-10892:0");
  assert.equal(drajeweled.definition.source.patternId, "cont-ride-from-grade-and-named-vanguard-v1");
  assert.equal(Engine.isManuallyActivatable(drajeweled), false);
  assert.equal(Engine.canRideCard(cards.get("cfa-10892"), { vanguardCard: { grade: 3, name: "Demonic Jewel Dragon, Drajeweled" } }), true);
  assert.equal(Engine.canRideCard(cards.get("cfa-10892"), { vanguardCard: { grade: 2, name: "Demonic Jewel Dragon, Drajeweled" } }), false);
  assert.equal(Engine.canRideCard(cards.get("cfa-10892"), { vanguardCard: { grade: 3, name: "Unrelated Vanguard" } }), false);

  const cannotRide = getAbility("cfa-10895:0");
  assert.deepEqual(cannotRide.definition.keywords, ["cannot-be-ridden"]);
  assert.equal(Engine.isManuallyActivatable(cannotRide), false);
  assert.equal(Engine.canRideCard(cards.get("cfa-10895")), false);
});
