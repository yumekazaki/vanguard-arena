"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-7812";
const ABILITY_ID = "cfa-7812:0";
const PATTERN = "cont-vc-rc-own-turn-named-vanguard-power-v1";
const CARD = loadCatalog().find(card => String(card.id) === CARD_ID);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const PLAYER_IDS = { human: "host-player", bot: "guest-player" };

function getAbility(card = CARD) {
  assert.ok(card, `catalog contains ${CARD_ID}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(value => value.id === ABILITY_ID);
  assert.ok(ability, `parsed ${ABILITY_ID}`);
  return ability;
}

function evaluate(location, overrides = {}) {
  const instanceId = "albert-tail-instance";
  return Engine.evaluateContinuousEffects([getAbility()], {
    location,
    sourceLocation: location,
    sourceInstanceId: instanceId,
    targetInstanceId: instanceId,
    isControllerTurn: true,
    controllerVanguardCardNames: ["True Ancient Dragon, Albert Tail"],
    ...overrides
  }).power;
}

function cardInstance(cardId, uid, ownerPlayerId, extra = {}) {
  const definition = loadCatalog().find(card => String(card.id) === String(cardId));
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
    controllerPlayerId: ownerPlayerId,
    ...extra
  });
}

function attackFixture(side) {
  const opponentSide = side === "human" ? "bot" : "human";
  const playerId = PLAYER_IDS[side];
  const opponentPlayerId = PLAYER_IDS[opponentSide];
  const source = cardInstance(CARD_ID, `source-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const opposingVanguard = cardInstance("cfa-1", `opponent-vanguard-${side}`, opponentPlayerId, { zone: "vanguard", circle: "vanguard" });
  const makePlayer = (id, vanguard) => ({
    playerId: id,
    vanguard,
    rear: Array(5).fill(null),
    hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [],
    guardCircle: [], triggerZone: [], gZone: [], gDeck: [], removed: [], giftZones: []
  });
  const state = {
    matchId: `albert-tail-${side}`,
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
    players: {
      [side]: makePlayer(playerId, source),
      [opponentSide]: makePlayer(opponentPlayerId, opposingVanguard)
    }
  };
  const command = {
    actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`,
    expectedStateVersion: state.stateVersion,
    payload: {
      type: "game-action",
      action: "attack",
      attackerCardInstanceId: source.uid,
      targetCardInstanceId: opposingVanguard.uid
    }
  };
  return { state, command, source };
}

test("the exact card text compiles as a continuous VC/RC ability with the printed turn, name, and power conditions", () => {
  const ability = getAbility();
  assert.equal(CARD.name, "True Ancient Dragon, Albert Tail");
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.printedText, "CONT [VC/RC]: During your turn, if you have a vanguard with \"Ancient Dragon\" in its card name, this unit gets power +5000.");
  assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(ability.definition.source.patternId, PATTERN);
  assert.equal(ability.definition.source.officialCardNumber, "V-BT10/062EN");
  assert.equal(ability.definition.source.officialTextVerified, false);
  assert.deepEqual(ability.definition.effects, [{
    op: "continuous-power",
    target: "source",
    amount: 5000,
    duration: "continuous",
    condition: {
      op: "all",
      conditions: [
        { op: "controller-turn" },
        { op: "controller-vanguard-card-name-contains", name: "Ancient Dragon" }
      ]
    }
  }]);
  assert.equal(Engine.isManuallyActivatable(ability), false);
});

test("the power is active on either printed circle only on its controller's turn with a matching Vanguard name", () => {
  assert.equal(evaluate("vanguard"), 5000);
  assert.equal(evaluate("rear-guard"), 5000);
  assert.equal(evaluate("vanguard", { isControllerTurn: false }), 0);
  assert.equal(evaluate("rear-guard", { controllerVanguardCardNames: ["Different Vanguard"] }), 0);
  assert.equal(evaluate("rear-guard", { sourceLocation: "guardian", location: "guardian" }), 0);
  assert.equal(evaluate("vanguard", { targetInstanceId: "different-instance" }), 0);
});

test("the exact continuous bonus contributes to both host and joining player's Vanguard attack power", () => {
  for (const side of ["human", "bot"]) {
    const fixture = attackFixture(side);
    const result = Reducer.applyGameAction(fixture.state, fixture.command, SEATS, Engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal((result.state || fixture.state).pendingAttack.power, Number(fixture.source.power) + 5000, `${side}: own Vanguard gets the name-gated power`);
  }
});

test("a circle change in the printed ability does not get accepted as the same keyword pattern", () => {
  const alteredCard = { ...CARD, text: CARD.text.replace("[VC/RC]", "[GC]") };
  const altered = Engine.parseCardAbilities(alteredCard).find(value => value.id === ABILITY_ID);
  assert.ok(altered, "altered card ability still parses");
  assert.equal(altered.definition, null);
});
