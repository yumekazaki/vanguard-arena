"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const PATTERN = "cont-vc-own-turn-hand-size-power-v1";
const FAMILY = new Map([
  ["cfa-1563:1", {
    cardId: "cfa-1563",
    cardName: "Hexagonal Magus",
    amount: 2000,
    catalogText: "CONT [VC]: During your turn, if the number of cards in your hand is four or greater, this unit gets power +2000.",
    officialCardNumber: "EB07/001EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=EB07%2F001EN&expansion=35&view=image",
    officialTextStatus: "equivalent-wording: official says 'four or more'; catalog says 'four or greater'"
  }],
  ["cfa-1933:1", {
    cardId: "cfa-1933",
    cardName: "Floral Magus",
    amount: 2000,
    catalogText: "CONT [VC]: During your turn, if the number of cards in your hand is four or greater, this unit gets power +2000.",
    officialCardNumber: "FC02/005EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=FC02%2F005EN",
    officialTextStatus: "equivalent-wording: official says 'four or more'; catalog says 'four or greater'"
  }],
  ["cfa-427:0", {
    cardId: "cfa-427",
    cardName: "CEO Amaterasu",
    amount: 4000,
    catalogText: "CONT [VC]: During your turn, if the number of cards in your hand is four or greater, this unit gets power +4000.",
    officialCardNumber: "EB05/001EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=EB05%2F001EN&expansion=25&view=text",
    officialTextStatus: "exact wording match; the same text also appears on BT01/006EN and PR/0097EN"
  }],
  ["cfa-429:0", {
    cardId: "cfa-429",
    cardName: "Goddess of Flower Divination, Sakuya",
    amount: 4000,
    catalogText: "CONT [VC]: During your turn, if the number of cards in your hand is four or more, this unit gets power +4000.",
    officialCardNumber: "EB05/004EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=EB05%2F004EN",
    officialTextStatus: "exact wording match"
  }]
]);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const PLAYER_IDS = { human: "host-player", bot: "guest-player" };

function abilityFor(abilityId) {
  const expected = FAMILY.get(abilityId);
  assert.ok(expected, `family includes ${abilityId}`);
  const card = CATALOG.get(expected.cardId);
  assert.ok(card, `catalog contains ${expected.cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(value => value.id === abilityId);
  assert.ok(ability, `parsed ${abilityId}`);
  return { expected, card, ability };
}

function makeCard(cardId, uid, ownerPlayerId, controllerPlayerId = ownerPlayerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return Engine.createCardInstance(String(cardId), ownerPlayerId, uid, {
    cardName: definition.name,
    type: definition.type,
    grade: Number(definition.grade),
    power: Number(definition.power),
    shield: Number(definition.shield),
    unitCard: definition.type === "Unit",
    critical: 1,
    drive: 1,
    controllerPlayerId,
    ...extra
  });
}

function serverAttackFixture({ abilityId, side, ownHandCount, opponentHandCount }) {
  const expected = FAMILY.get(abilityId);
  const playerId = PLAYER_IDS[side];
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = PLAYER_IDS[opponentSide];
  const source = makeCard(expected.cardId, `source-${abilityId}-${side}`, playerId, playerId, {
    zone: "vanguard", circle: "vanguard"
  });
  const opponentVanguard = makeCard("cfa-1", `opponent-vanguard-${side}`, opponentPlayerId, opponentPlayerId, {
    zone: "vanguard", circle: "vanguard"
  });
  const makePlayer = (id, vanguard, handCount) => ({
    playerId: id,
    vanguard,
    rear: Array(5).fill(null),
    hand: Array.from({ length: handCount }, (_, index) => ({
      uid: `hand-${id}-${index}`,
      ownerPlayerId: id,
      controllerPlayerId: id
    })),
    deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [],
    guardCircle: [], triggerZone: [], gZone: [], gDeck: [], removed: [], giftZones: []
  });
  const owner = makePlayer(playerId, source, ownHandCount);
  const opponent = makePlayer(opponentPlayerId, opponentVanguard, opponentHandCount);
  const state = {
    matchId: `hand-size-cont-${abilityId}-${side}-${ownHandCount}-${opponentHandCount}`,
    stateVersion: 1,
    turn: 2,
    side,
    phase: 5,
    firstTurnComplete: true,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    pendingAttack: null,
    players: { [side]: owner, [opponentSide]: opponent }
  };
  const command = {
    actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`,
    expectedStateVersion: state.stateVersion,
    payload: {
      type: "game-action",
      action: "attack",
      attackerCardInstanceId: source.uid,
      targetCardInstanceId: opponentVanguard.uid
    }
  };
  return { state, command, source, expected };
}

test("four catalog abilities retain their verified names, exact catalog text, and official source notes", () => {
  for (const [abilityId, expected] of FAMILY) {
    const { card, ability } = abilityFor(abilityId);
    assert.equal(card.name, expected.cardName, abilityId);
    assert.equal(ability.kind, "CONT", abilityId);
    assert.equal(ability.printedText, expected.catalogText, abilityId);
    assert.ok(expected.officialCardNumber, `${abilityId}: official card number recorded`);
    assert.match(expected.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//, abilityId);
    assert.ok(expected.officialTextStatus.length > 0, `${abilityId}: text comparison is qualified`);
  }
});

test("the four hand-size CONT abilities compile as source-only VC power modifiers", () => {
  for (const [abilityId, expected] of FAMILY) {
    const { ability } = abilityFor(abilityId);
    assert.ok(ability.definition, `${abilityId}: trusted structured definition exists`);
    assert.equal(ability.definition.source?.patternId, PATTERN, abilityId);
    assert.deepEqual(ability.requiredLocation, ["vanguard"], abilityId);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-power",
      target: "source",
      amount: expected.amount,
      duration: "continuous",
      condition: {
        op: "all",
        conditions: [
          { op: "controller-turn" },
          { op: "controller-hand-size-at-least", count: 4 }
        ]
      }
    }]);
    assert.equal(Engine.isManuallyActivatable(ability), false, abilityId);
  }
});

test("the continuous bonus turns on and off as the controller's hand crosses four cards", () => {
  for (const [abilityId, expected] of FAMILY) {
    const { ability } = abilityFor(abilityId);
    const context = {
      location: "vanguard",
      sourceLocation: "vanguard",
      sourceInstanceId: `source-${abilityId}`,
      targetInstanceId: `source-${abilityId}`,
      isControllerTurn: true,
      controllerHandCount: 3
    };
    assert.equal(Engine.evaluateContinuousEffects([ability], context).power, 0, `${abilityId}: hand size 3`);
    context.controllerHandCount = 4;
    assert.equal(Engine.evaluateContinuousEffects([ability], context).power, expected.amount, `${abilityId}: hand size 4`);
    context.controllerHandCount = 3;
    assert.equal(Engine.evaluateContinuousEffects([ability], context).power, 0, `${abilityId}: hand size returns to 3`);
    context.controllerHandCount = 5;
    assert.equal(Engine.evaluateContinuousEffects([ability], context).power, expected.amount, `${abilityId}: hand size 5`);
  }
});

test("the hand-size ability is inactive on the opponent's turn, off VC, or for another source instance", () => {
  for (const [abilityId] of FAMILY) {
    const { ability, expected } = abilityFor(abilityId);
    const sourceInstanceId = `source-${abilityId}`;
    const evaluate = overrides => Engine.evaluateContinuousEffects([ability], {
      location: "vanguard",
      sourceLocation: "vanguard",
      sourceInstanceId,
      targetInstanceId: sourceInstanceId,
      isControllerTurn: true,
      controllerHandCount: 4,
      ...overrides
    }).power;
    assert.equal(evaluate({ isControllerTurn: false }), 0, `${abilityId}: opponent's turn`);
    assert.equal(evaluate({ location: "rear-guard", sourceLocation: "rear-guard" }), 0, `${abilityId}: RC`);
    assert.equal(evaluate({ location: "guardian", sourceLocation: "guardian" }), 0, `${abilityId}: GC`);
    assert.equal(evaluate({ targetInstanceId: `different-${sourceInstanceId}` }), 0, `${abilityId}: mismatched target/source`);
    assert.equal(evaluate({}), expected.amount, `${abilityId}: exact source on VC`);
  }
});

test("authoritative Vanguard attack power uses each acting player's own hand for host and joiner", () => {
  for (const [abilityId, expected] of FAMILY) for (const side of ["human", "bot"]) {
    for (const scenario of [
      { ownHandCount: 3, opponentHandCount: 6, expectedBonus: 0 },
      { ownHandCount: 4, opponentHandCount: 1, expectedBonus: expected.amount }
    ]) {
      const fixture = serverAttackFixture({ abilityId, side, ...scenario });
      const result = Reducer.applyGameAction(fixture.state, fixture.command, SEATS, Engine);
      assert.equal(result.ok, true, `${abilityId}/${side}/${scenario.ownHandCount}: ${result.reason}`);
      const resolvedState = result.state || fixture.state;
      assert.equal(
        resolvedState.pendingAttack.power,
        Number(fixture.source.power) + scenario.expectedBonus,
        `${abilityId}/${side}: authority uses only the acting controller's hand count`
      );
    }
  }
});
