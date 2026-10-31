"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-CANDIDATE-C0086556-0015.js");
Engine.registerAbilityDefinitions(contribution);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-vc-rc-power-penalty-unless-vanguard-name-one-of-v1";
const FAMILY = new Map([
  ["cfa-24", ["Phantom Blaster Dragon", "Blaster Dark"]],
  ["cfa-251", ["Enigman Storm", "Enigman Wave"]],
  ["cfa-536", ["Amber Dragon, Eclipse", "Amber Dragon, Dusk"]],
  ["cfa-63", ["Evil Armor General, Giraffa", "Elite Mutant, Giraffa"]]
]);
const cards = loadCatalog();
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function findAbility(cardId, index) {
  const card = cards.find(value => value.id === cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  return Engine.parseCardAbilitiesCached(card).find(ability => ability.id === `${cardId}:${index}`);
}

function continuousAdjustment(ability, { location, names = [], opponentNames = [], fieldNames = [], source = "source", target = source }) {
  return Engine.evaluateContinuousEffects([ability], {
    location,
    sourceInstanceId: source,
    targetInstanceId: target,
    controllerVanguardCardNames: names,
    opponentVanguardCardNames: opponentNames,
    controllerFieldCards: fieldNames.map((name, index) => ({ uid: `rear-${index}`, zone: "rear-guard", names: [name] }))
  }).power;
}

function unit(uid, cardId, cardName, playerId, grade, power) {
  return {
    uid, cardId, cardName, type: "Normal Unit", unitCard: true, grade, power,
    critical: 1, drive: 1, rested: false, locked: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId
  };
}

function player(playerId, vanguard, rear = []) {
  return {
    playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [],
    orders: [], crests: [], giftZones: [], guardCircle: [], extra: [], gDeck: [], gZone: [],
    removed: [], triggerZone: []
  };
}

function attackPower({ cardId, side, sourceLocation, controllerVanguardName = "Unrelated Vanguard", opponentVanguardName = "Opponent Vanguard", actionTag }) {
  const card = cards.find(value => value.id === cardId);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = unit(`source-${side}-${cardId}-${sourceLocation}-${actionTag}`, cardId, card.name, ownerId, 2, 10000);
  const friendlyVanguard = sourceLocation === "vanguard"
    ? source
    : unit(`friendly-vanguard-${side}-${cardId}-${actionTag}`, "fixture-own-vanguard", controllerVanguardName, ownerId, 3, 13000);
  const opposingVanguard = unit(`opposing-vanguard-${side}-${cardId}-${actionTag}`, "fixture-opponent-vanguard", opponentVanguardName, opponentId, 3, 13000);
  const state = {
    matchId: `name-penalty-${side}-${cardId}-${sourceLocation}-${actionTag}`,
    stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true,
    processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    authoritySeats: { hostSide: "human", guestSide: "bot" },
    players: {
      [side]: player(ownerId, friendlyVanguard, sourceLocation === "rear-guard" ? [source] : []),
      [opponentSide]: player(opponentId, opposingVanguard)
    }
  };
  const result = Reducer.applyGameAction(state, {
    actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`,
    expectedStateVersion: 0,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid }
  }, SEATS, Engine);
  assert.equal(result.ok, true, `${side}/${cardId}/${sourceLocation}/${actionTag}: ${result.reason}`);
  return Number(result.state.pendingAttack.power);
}

test("the four exact CONT penalties preserve catalog text, IDs, scope, and compile cleanly", () => {
  assert.deepEqual(contribution.map(ability => ability.id).sort(), [...FAMILY.keys()].map(cardId => `${cardId}:0`).sort());
  for (const [cardId, names] of FAMILY) {
    const ability = findAbility(cardId, 0);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.printedText, cards.find(card => card.id === cardId).text.split("\n\n")[1]);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-power-adjustment",
      target: "source",
      amount: -5000,
      duration: "continuous",
      condition: {
        op: "not",
        condition: {
          op: "any",
          conditions: names.map(name => ({ op: "controller-vanguard-card-name-equals", name }))
        }
      }
    }]);
    assert.equal(ability.choiceStatus, "no-explicit-choice-detected");
  }
  const report = auditCatalog(cards, Engine.parseCardAbilitiesCached);
  assert.equal(report.patterns[PATTERN], FAMILY.size);
  assert.deepEqual(report.invalidCompiled, []);
});

test("both seats receive the VC/RC penalty except for either exact controller Vanguard name", () => {
  for (const side of ["human", "bot"]) for (const [cardId, names] of FAMILY) {
    const ability = findAbility(cardId, 0);
    for (const location of ["vanguard", "rear-guard"]) {
      assert.equal(continuousAdjustment(ability, { location }), -5000, `${side}/${cardId}/${location} without exception`);
      for (const name of names) assert.equal(continuousAdjustment(ability, { location, names: [name] }), 0, `${side}/${cardId}/${location} with ${name}`);
      assert.equal(continuousAdjustment(ability, { location, names: [`${names[0]} Vanguard`] }), -5000, `${side}/${cardId}/${location} rejects substring name`);
      assert.equal(continuousAdjustment(ability, { location, names: ["Unrelated Vanguard"] }), -5000, `${side}/${cardId}/${location} unrelated name`);
      assert.equal(continuousAdjustment(ability, { location, names: ["Unrelated Vanguard"], opponentNames: [names[0]] }), -5000, `${side}/${cardId}/${location} ignores opponent Vanguard`);
      assert.equal(continuousAdjustment(ability, { location, names: ["Unrelated Vanguard"], fieldNames: [names[1]] }), -5000, `${side}/${cardId}/${location} ignores Rear-Guard names`);
    }
    assert.equal(continuousAdjustment(ability, { location: "guardian", names: ["Unrelated Vanguard"] }), 0, `${side}/${cardId} outside VC/RC`);
    assert.equal(continuousAdjustment(ability, { location: "rear-guard", source: "source", target: "different-source" }), 0, `${side}/${cardId} wrong target instance`);

    const livePower = namesOnVanguard => 10000 + continuousAdjustment(ability, { location: "rear-guard", names: namesOnVanguard });
    assert.deepEqual([livePower([]), livePower([names[0]]), livePower([]), livePower([names[1]])], [5000, 10000, 5000, 10000], `${side}/${cardId} continuously recomputes after Vanguard changes`);
  }
});

test("authoritative attacks apply the penalty only from the controller's current Vanguard, for either seat", () => {
  for (const side of ["human", "bot"]) for (const [cardId, names] of FAMILY) {
    const vcPower = attackPower({ cardId, side, sourceLocation: "vanguard", actionTag: "vc" });
    const rcPenaltyPower = attackPower({ cardId, side, sourceLocation: "rear-guard", actionTag: "rc-penalty" });
    assert.equal(vcPower - rcPenaltyPower, 0, `${side}/${cardId} VC and RC use the same live penalty when neither name is present`);
    for (const name of names) {
      const allowedPower = attackPower({ cardId, side, sourceLocation: "rear-guard", controllerVanguardName: name, actionTag: `allowed-${name}` });
      assert.equal(allowedPower - rcPenaltyPower, 5000, `${side}/${cardId} exact Vanguard name removes penalty`);
    }
    const substringPower = attackPower({ cardId, side, sourceLocation: "rear-guard", controllerVanguardName: `${names[0]} Vanguard`, actionTag: "substring" });
    assert.equal(substringPower, rcPenaltyPower, `${side}/${cardId} substring does not remove penalty`);
    const opponentNamePower = attackPower({ cardId, side, sourceLocation: "rear-guard", opponentVanguardName: names[0], actionTag: "opponent-name" });
    assert.equal(opponentNamePower, rcPenaltyPower, `${side}/${cardId} opponent Vanguard does not remove penalty`);
  }
});

test("each sibling own-attack AUTO is already trusted and is not duplicated by this contribution", () => {
  assert.equal(contribution.some(ability => ability.id.endsWith(":1")), false);
  for (const cardId of FAMILY.keys()) {
    const ability = findAbility(cardId, 1);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.trigger.status, "recognized-trigger");
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.costs, []);
    assert.deepEqual(ability.conditions, []);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]);
    assert.equal(ability.canDecline, false);
    assert.ok(typeof ability.definition.source?.review === "string" && ability.definition.source.review.length > 0);
  }
});
