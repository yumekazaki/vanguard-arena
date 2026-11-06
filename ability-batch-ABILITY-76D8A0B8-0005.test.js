"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-contributions/batch-ABILITY-76D8A0B8-0005.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerAbilityDefinitions(definitions);

const FAMILY = "cont-rc-gc-opponent-check-trigger-power-shield-v1";
const PRINTED_TEXT = "CONT [RC/GC]: If your opponent’s drive check or damage check revealed a trigger unit this turn, this unit gets power +10000 / shield +10000.";
const OFFICIAL_CARDS = [
  ["cfa-10921:0", "Divine Knight of Deeply-laid Strategems, Sajess", "D-SS05/008EN", "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F008EN&expansion=206&view=image"],
  ["cfa-10924:0", "Elbard X-striker", "D-SS05/FFR03EN", "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2FFFR03EN&expansion=206&s_param=d-Brandt+Gate&view=image"],
  ["cfa-10925:0", "Yearnful Flower Maiden, Florence", "D-SS05/009EN", "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F009EN&expansion=206&s_param=d-Stoicheia&view=image"]
];
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));

function abilityFor(id) {
  const cardId = id.split(":")[0];
  const card = cards.get(cardId);
  assert.ok(card, `real catalog card exists: ${cardId}`);
  return { card, ability: Engine.parseCardAbilitiesCached(card).find(item => item.id === id) };
}

function players() {
  return {
    host: { playerId: "host-player", opponentTriggerRevealedThisTurn: false },
    guest: { playerId: "guest-player", opponentTriggerRevealedThisTurn: false }
  };
}

function evaluateAt(ability, location, active) {
  const context = { location, opponentTriggerRevealedThisTurn: active };
  return {
    power: Engine.evaluateContinuousEffects([ability], context).power,
    shield: Engine.evaluateContinuousShieldEffects([ability], context).shield
  };
}

test("the assigned Sajess, Elbard X-striker, and Florence CONTs match official text and trusted continuous handling", () => {
  assert.deepEqual(definitions.map(item => item.id).sort(), OFFICIAL_CARDS.map(([id]) => id).sort());

  for (const [id, name, cardNumber, officialReference] of OFFICIAL_CARDS) {
    const { card, ability } = abilityFor(id);
    const definition = definitions.find(item => item.id === id);
    assert.ok(ability, `catalog ability exists: ${id}`);
    assert.ok(card.text.includes(PRINTED_TEXT), `${id} original catalog text`);
    assert.equal(card.name, name);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.printedText, PRINTED_TEXT);
    assert.equal(definition.printedText, ability.printedText);
    assert.equal(definition.cardId, card.id);
    assert.equal(definition.source.patternId, FAMILY);
    assert.equal(definition.source.dataset, "Bushiroad official card list");
    assert.equal(definition.source.officialCardNumber, cardNumber);
    assert.equal(definition.source.officialReference, officialReference);
    assert.deepEqual(definition.requiredLocation, ["rear-guard", "guardian"]);
    assert.deepEqual(definition.effects, [
      { op: "continuous-power", target: "source", amount: 10000, duration: "continuous", location: "rear-guard", condition: { op: "opponent-trigger-revealed-this-turn" } },
      { op: "continuous-shield", target: "source", amount: 10000, duration: "continuous", location: "guardian", condition: { op: "opponent-trigger-revealed-this-turn" } }
    ]);
    assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(card.id).find(item => item.id === id), definition);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${id} is continuous and never a manual activation`);
  }
});

test("qualifying drive and damage checks grant the CONT only to the checker’s opponent for both seats", () => {
  for (const [id] of OFFICIAL_CARDS) {
    const { ability } = abilityFor(id);
    for (const checkType of ["drive", "damage"]) {
      for (const checkerSide of ["host", "guest"]) {
        const statePlayers = players();
        const checkerPlayerId = statePlayers[checkerSide].playerId;
        assert.equal(Engine.recordOpponentTriggerCheck(statePlayers, checkerPlayerId, "critical", checkType), true);

        const ownerSide = checkerSide === "host" ? "guest" : "host";
        assert.equal(statePlayers[checkerSide].opponentTriggerRevealedThisTurn, false, "the checker does not qualify from their own check");
        assert.equal(statePlayers[ownerSide].opponentTriggerRevealedThisTurn, true, "only the checker’s opponent qualifies");

        const active = evaluateAt(ability, "rear-guard", statePlayers[ownerSide].opponentTriggerRevealedThisTurn);
        assert.equal(active.power, 10000, `${id} power for ${ownerSide}, opponent ${checkType} check`);
        assert.equal(active.shield, 0, `${id} does not gain shield on RC`);
        const inactive = evaluateAt(ability, "rear-guard", statePlayers[checkerSide].opponentTriggerRevealedThisTurn);
        assert.equal(inactive.power, 0, `${id} does not gain power for ${checkerSide}'s own check`);
      }
    }
  }
});

test("power and shield are restricted to their printed circles and the bonus expires at turn end", () => {
  for (const [id] of OFFICIAL_CARDS) {
    const { ability } = abilityFor(id);
    for (const location of ["rear-guard", "guardian", "vanguard", "hand", "soul"]) {
      const active = evaluateAt(ability, location, true);
      assert.equal(active.power, location === "rear-guard" ? 10000 : 0, `${id} power at ${location}`);
      assert.equal(active.shield, location === "guardian" ? 10000 : 0, `${id} shield at ${location}`);
      const inactive = evaluateAt(ability, location, false);
      assert.deepEqual(inactive, { power: 0, shield: 0 }, `${id} has no bonus without a qualifying opponent trigger`);
    }

    const statePlayers = players();
    assert.equal(Engine.recordOpponentTriggerCheck(statePlayers, "host-player", "heal", "damage"), true);
    assert.equal(statePlayers.guest.opponentTriggerRevealedThisTurn, true);
    assert.equal(evaluateAt(ability, "rear-guard", true).power, 10000);
    assert.equal(Engine.clearOpponentTriggerFacts(statePlayers), true);
    assert.equal(statePlayers.host.opponentTriggerRevealedThisTurn, false);
    assert.equal(statePlayers.guest.opponentTriggerRevealedThisTurn, false);
    assert.deepEqual(evaluateAt(ability, "rear-guard", statePlayers.guest.opponentTriggerRevealedThisTurn), { power: 0, shield: 0 });
  }
});

test("non-trigger checks, missing triggers, and unknown checkers cannot set the condition", () => {
  const statePlayers = players();
  assert.equal(Engine.recordOpponentTriggerCheck(statePlayers, "host-player", "critical", "trigger"), false);
  assert.equal(Engine.recordOpponentTriggerCheck(statePlayers, "host-player", "", "drive"), false);
  assert.equal(Engine.recordOpponentTriggerCheck(statePlayers, "unknown-player", "critical", "drive"), false);
  for (const [id] of OFFICIAL_CARDS) {
    const { ability } = abilityFor(id);
    assert.deepEqual(evaluateAt(ability, "rear-guard", statePlayers.guest.opponentTriggerRevealedThisTurn), { power: 0, shield: 0 });
    assert.deepEqual(evaluateAt(ability, "guardian", statePlayers.host.opponentTriggerRevealedThisTurn), { power: 0, shield: 0 });
  }
});
