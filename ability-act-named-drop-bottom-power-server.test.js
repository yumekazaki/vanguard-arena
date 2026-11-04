"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SPECS = Object.freeze({
  "cfa-1698": { name: "Regalia", clan: "Genesis", costCardId: "cfa-1690", targetCardId: "cfa-1685", vanguardCardId: "cfa-1685", cardNumber: "BT14/074EN" },
  "cfa-1705": { name: "Gancelot", clan: "Gold Paladin", costCardId: "cfa-1099", targetCardId: "cfa-1700", vanguardCardId: "cfa-1700", cardNumber: "BT14/061EN" },
  "cfa-1708": { name: "Ashlei", clan: "Royal Paladin", costCardId: "cfa-1697", targetCardId: "cfa-1155", vanguardCardId: "cfa-1155", cardNumber: "BT14/048EN" }
});
const CARD_BY_ID = new Map(loadCatalog().map(card => [String(card.id), card]));
const OTHER_GRADE_THREE = loadCatalog().find(card => card.type === "Unit" && Number(card.grade) === 3 && !Object.values(SPECS).some(spec => spec.clan === card.clan));
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function instance(cardId, uid, playerId, overrides = {}) {
  const definition = CARD_BY_ID.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, grade: Number(definition.grade), unitCard: definition.type === "Unit",
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function blankPlayer(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}

function fixture(cardId, side = "human", options = {}) {
  const spec = SPECS[cardId], playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const catalogCard = CARD_BY_ID.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(catalogCard).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 compiles`);
  const source = instance(cardId, `source-${cardId}-${side}`, playerId);
  const target = instance(options.targetCardId || spec.targetCardId, `target-${cardId}-${side}`, playerId);
  const costCard = instance(options.costCardId || spec.costCardId, `cost-${cardId}-${side}`, options.costOwnerId || playerId);
  const vanguard = instance(options.vanguardCardId || spec.vanguardCardId, `vanguard-${side}`, playerId);
  const blank = { human: blankPlayer("player-host"), bot: blankPlayer("player-guest") };
  blank[side].rear[0] = source;
  blank[side].rear[1] = target;
  blank[side].vanguard = vanguard;
  if (!options.omitCost) blank[side].drop.push(costCard);
  blank[side].deck.push({ uid: `deck-top-${side}`, cardId: "deck-top", ownerPlayerId: playerId, controllerPlayerId: playerId });
  blank[side === "human" ? "bot" : "human"].vanguard = instance(OTHER_GRADE_THREE.id, `enemy-vanguard-${side}`, opponentId);
  const state = { matchId: "act-named-drop-bottom-power", stateVersion: 1, processedActionIds: [], turn: 2, phase: 4, side, players: blank };
  return { state, ability, source, target, costCard, playerId, opponentId, side };
}

function activate(f, options = {}) {
  const auth = options.auth || (f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid);
  const costUids = options.costUids || [f.costCard.uid];
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: auth,
    actionId: options.actionId || `activate-${f.source.uid}-${f.state.stateVersion}`,
    expectedStateVersion: options.expectedStateVersion ?? f.state.stateVersion,
    payload: {
      sourceCardInstanceId: f.source.uid,
      abilityId: f.ability.id,
      selection: {
        targetUid: options.targetUid ?? f.target.uid,
        costSelections: { cb: [], sb: [], discard: [], gradeSumDiscard: [], reveal: [], dropToDeckBottom: costUids }
      }
    }
  }, SEATS, Engine);
}

test("the three official BT14 ACT abilities compile to their exact reviewed mechanics", () => {
  for (const [cardId, spec] of Object.entries(SPECS)) {
    const f = fixture(cardId);
    const definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === f.ability.id);
    assert.ok(definition, `${cardId}:0 is registered as reviewed`);
    assert.equal(definition.source.officialCardNumber, spec.cardNumber);
    assert.equal(definition.source.officialReference, `https://en.cf-vanguard.com/cardlist/?cardno=${encodeURIComponent(spec.cardNumber)}`);
    assert.equal(f.ability.kind, "ACT");
    assert.equal(f.ability.definition.source.patternId, "act-rc-return-named-grade-from-drop-to-deck-bottom-named-grade-power-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: spec.clan }]);
    assert.deepEqual(f.ability.costs, [{ type: "return-filtered-drop-to-deck-bottom", count: 1, filter: { minGrade: 3, maxGrade: 3, cardNameContains: spec.name } }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", minGrade: 3, maxGrade: 3, cardNameContains: spec.name } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player pay their own matching Drop card and power their own chosen unit", () => {
  for (const cardId of Object.keys(SPECS)) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    const result = activate(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.players[side].drop.some(card => card.uid === f.costCard.uid), false);
    assert.equal(f.state.players[side].deck[0].uid, f.costCard.uid, "the cost card is placed at the bottom of the Deck");
    assert.equal(f.target.turnPowerBoost, 5000);
    assert.equal(f.target.turnPowerExpiry, f.playerId);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].vanguard.turnPowerBoost, undefined);
  }
});

test("the ability is repeatable during its legal window when a fresh cost is available", () => {
  const f = fixture("cfa-1698");
  const secondCost = instance("cfa-1685", "second-regalia-cost", f.playerId);
  f.state.players.human.drop.push(secondCost);
  assert.equal(activate(f).ok, true);
  const repeated = Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: "repeat-with-distinct-request", expectedStateVersion: f.state.stateVersion,
    payload: { sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { targetUid: f.target.uid, costSelections: { dropToDeckBottom: [secondCost.uid] } } }
  }, SEATS, Engine);
  assert.equal(repeated.ok, true, repeated.reason);
  assert.equal(f.state.players.human.deck[0].uid, secondCost.uid);
  assert.equal(f.state.players.human.usedAbilities?.length || 0, 0);
});

test("wrong clan, missing or wrong-name cost, foreign-owned cost, and invalid target are rejected atomically", () => {
  for (const cardId of Object.keys(SPECS)) {
    const wrongClan = fixture(cardId, "human", { vanguardCardId: OTHER_GRADE_THREE.id });
    let before = JSON.stringify(wrongClan.state);
    assert.equal(activate(wrongClan).ok, false);
    assert.equal(JSON.stringify(wrongClan.state), before);

    const missingCost = fixture(cardId, "human", { omitCost: true });
    before = JSON.stringify(missingCost.state);
    assert.equal(activate(missingCost).ok, false);
    assert.equal(JSON.stringify(missingCost.state), before);

    const wrongName = fixture(cardId, "human", { costCardId: OTHER_GRADE_THREE.id });
    before = JSON.stringify(wrongName.state);
    assert.equal(activate(wrongName).ok, false);
    assert.equal(JSON.stringify(wrongName.state), before);

    const foreignCost = fixture(cardId, "human", { costOwnerId: "player-guest" });
    before = JSON.stringify(foreignCost.state);
    assert.equal(activate(foreignCost).ok, false);
    assert.equal(JSON.stringify(foreignCost.state), before);

    const wrongTarget = fixture(cardId, "human", { targetCardId: OTHER_GRADE_THREE.id });
    before = JSON.stringify(wrongTarget.state);
    assert.equal(activate(wrongTarget).ok, false);
    assert.equal(JSON.stringify(wrongTarget.state), before);
  }
});

test("forged player identity and stale duplicate requests do not pay or resolve twice", () => {
  const forged = fixture("cfa-1698", "bot");
  let before = JSON.stringify(forged.state);
  assert.equal(activate(forged, { auth: SEATS.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(forged.state), before);

  const duplicate = fixture("cfa-1705", "human");
  const actionId = "one-activation-request";
  assert.equal(activate(duplicate, { actionId }).ok, true);
  before = JSON.stringify(duplicate.state);
  const replay = activate(duplicate, { actionId, expectedStateVersion: 1 });
  assert.equal(replay.ok, false);
  assert.equal(JSON.stringify(duplicate.state), before);
});

