"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("./ability-engine.js");
const baseDefinitions = require("./ability-definitions.js");
const batchDefinitions = require("./ability-contributions/batch-CANDIDATE-C0086556-0016.js");

const cardClans = new Map(batchDefinitions.map(definition => [definition.cardId, definition.effects[0].condition.clan]));
const expectedCardIds = ["cfa-155", "cfa-547", "cfa-624", "cfa-625"];
assert.deepEqual([...cardClans.keys()].sort(), expectedCardIds);
const cardMetadata = Object.fromEntries([
  ...[...cardClans].map(([id, clan]) => [id, { id, name: `Source ${id}`, type: "Unit", grade: 3, power: 11000, shield: 0, clan, clans: [clan] }]),
  ["test-other-clan", { id: "test-other-clan", name: "Other Clan Unit", type: "Unit", grade: 3, power: 10000, shield: 0, clan: "Other Clan", clans: ["Other Clan"] }],
  ["test-target", { id: "test-target", name: "Opponent Vanguard", type: "Unit", grade: 3, power: 10000, shield: 0, clan: "Other Clan", clans: ["Other Clan"] }]
]);
globalThis.VanguardCardRulesMetadata = { byId: cardMetadata };
globalThis.VanguardCardNameIndex = { byId: Object.fromEntries(Object.entries(cardMetadata).map(([id, metadata]) => [id, metadata.name])) };
const reducer = require("./ability-server-reducer.js");

engine.registerAbilityDefinitions(baseDefinitions);
engine.registerAbilityDefinitions(batchDefinitions);

function fieldCard(uid, cardId, controllerPlayerId, zone) {
  return { uid, cardId, controllerPlayerId, zone };
}

function abilityFor(cardId) {
  return batchDefinitions.find(definition => definition.cardId === cardId);
}

function enginePower(cardId, sourceLocation, controllerPlayerId, controllerFieldCards, sourceId = "source") {
  const ability = abilityFor(cardId);
  return engine.evaluateContinuousEffects([{
    id: ability.id,
    cardId,
    kind: "CONT",
    requiredLocation: ability.requiredLocation,
    definition: ability
  }], {
    location: sourceLocation,
    sourceInstanceId: sourceId,
    targetInstanceId: sourceId,
    controllerPlayerId,
    controllerFieldCards,
    cardDefinitionForInstance: card => cardMetadata[card?.cardId] || null
  }).power;
}

function runEngineCases() {
  for (const [cardId, clan] of cardClans) {
    const controller = "player-host", opponent = "player-guest";
    for (const [location, zone] of [["vanguard", "vanguard"], ["rear-guard", "rear-guard"]]) {
      const source = fieldCard("source", cardId, controller, zone);
      const ownOtherClanVanguard = zone === "vanguard" ? null : fieldCard("other-vanguard", "test-other-clan", controller, "vanguard");
      const field = [source, ownOtherClanVanguard].filter(Boolean);
      assert.equal(enginePower(cardId, location, controller, field), -2000, `${cardId} should exclude its own ${zone} instance`);
      assert.equal(enginePower(cardId, location, controller, [...field, fieldCard("opponent-same", cardId, opponent, "rear-guard")]), -2000, `${cardId} must ignore an opponent's ${clan} unit`);

      const sameClanUnit = fieldCard("own-same", cardId, controller, zone === "vanguard" ? "rear-guard" : "vanguard");
      assert.equal(enginePower(cardId, location, controller, [...field, sameClanUnit]), 0, `${cardId} must count another own ${clan} unit`);
      assert.equal(enginePower(cardId, location, controller, [...field, sameClanUnit, fieldCard("opponent-same-2", cardId, opponent, "rear-guard")]), 0, `${cardId} must count its own unit independently of opponent units`);
    }

    const source = fieldCard("source", cardId, "player-guest", "vanguard");
    const other = fieldCard("other", "test-other-clan", "player-guest", "rear-guard");
    assert.equal(enginePower(cardId, "vanguard", "player-guest", [source, other]), -2000, `${cardId} should not count a known different clan`);
    assert.equal(enginePower(cardId, "vanguard", "player-guest", [source, { ...other, cardId: "test-unknown-clan", clans: [] }]), 0, `${cardId} must fail closed when another own unit's clan is unknown`);
    assert.equal(enginePower(cardId, "vanguard", "", [source]), 0, `${cardId} must fail closed without controller identity`);
    assert.equal(enginePower(cardId, "vanguard", "player-guest", [source], "missing-source"), 0, `${cardId} must fail closed when the source is absent from the controller field`);
    assert.equal(enginePower(cardId, "hand", "player-guest", [source]), 0, `${cardId} must not apply outside VC/RC`);

    let dynamicField = [source, other];
    assert.equal(enginePower(cardId, "vanguard", "player-guest", dynamicField), -2000, `${cardId} starts with the penalty`);
    dynamicField = [...dynamicField, fieldCard("added-same-clan", cardId, "player-guest", "rear-guard")];
    assert.equal(enginePower(cardId, "vanguard", "player-guest", dynamicField), 0, `${cardId} clears the penalty after a matching unit is added`);
    dynamicField = dynamicField.filter(card => card.uid !== "added-same-clan");
    assert.equal(enginePower(cardId, "vanguard", "player-guest", dynamicField), -2000, `${cardId} reapplies the penalty after the matching unit leaves`);
  }
}

function instance(uid, cardId, controllerPlayerId) {
  const metadata = cardMetadata[cardId];
  return {
    uid, cardId, cardName: metadata.name, type: "Unit", unitCard: true,
    grade: metadata.grade, power: metadata.power, critical: 1, shield: metadata.shield,
    clan: metadata.clan, clans: metadata.clans,
    ownerPlayerId: controllerPlayerId, controllerPlayerId,
    rested: false, locked: false, position: "stand"
  };
}

function reducerAttack(cardId, sourceLocation, attackerSide, addOwnSameClanUnit = false) {
  const controllerId = attackerSide === "host" ? "player-host" : "player-guest";
  const opponentSide = attackerSide === "host" ? "guest" : "host";
  const opponentId = attackerSide === "host" ? "player-guest" : "player-host";
  const source = instance(`source-${cardId}`, cardId, controllerId);
  const controller = {
    playerId: controllerId,
    vanguard: sourceLocation === "vanguard" ? source : instance(`controller-vanguard-${cardId}`, addOwnSameClanUnit ? cardId : "test-other-clan", controllerId),
    rear: Array(5).fill(null), deck: [], hand: [], damage: [], drop: [], soul: [], bind: [],
    orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], removed: []
  };
  if (sourceLocation === "rear-guard") controller.rear[0] = source;
  if (addOwnSameClanUnit) {
    if (sourceLocation === "vanguard") controller.rear[0] = instance(`same-clan-${cardId}`, cardId, controllerId);
    else controller.vanguard = instance(`same-clan-vanguard-${cardId}`, cardId, controllerId);
  }
  const opponent = {
    playerId: opponentId,
    vanguard: instance(`target-${cardId}`, "test-target", opponentId),
    rear: [instance(`opponent-same-${cardId}`, cardId, opponentId), null, null, null, null],
    deck: [], hand: [], damage: [], drop: [], soul: [], bind: [],
    orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], removed: []
  };
  const players = attackerSide === "host" ? { host: controller, guest: opponent } : { host: opponent, guest: controller };
  const state = {
    matchId: "cont-no-other-clan-test",
    stateVersion: 0,
    turn: 1,
    side: attackerSide,
    phase: 5,
    firstTurnComplete: true,
    ended: false,
    players
  };
  const actorAuthUid = attackerSide === "host" ? "auth-host" : "auth-guest";
  const result = reducer.applyGameAction(state, {
    actionId: `attack-${attackerSide}-${cardId}-${sourceLocation}-${addOwnSameClanUnit ? "with-peer" : "alone"}`,
    actorAuthUid,
    expectedStateVersion: 0,
    payload: { action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: `target-${cardId}` }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "host", guestSide: "guest" }, engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state.pendingAttack.power;
}

function runReducerCases() {
  for (const cardId of cardClans.keys()) {
    for (const side of ["host", "guest"]) {
      for (const location of ["vanguard", "rear-guard"]) {
        const basePower = cardMetadata[cardId].power;
        assert.equal(reducerAttack(cardId, location, side), basePower - 2000, `${cardId} should lose power on ${location} for ${side}`);
        assert.equal(reducerAttack(cardId, location, side, true), basePower, `${cardId} should clear the penalty when another own clan unit is present for ${side}`);
      }
    }
  }
}

function runCatalogAudit() {
  const catalogSandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("./assets/cards/catalog-data.js"), "utf8"), catalogSandbox, { timeout: 15000 });
  const cards = catalogSandbox.window.CARD_CATALOG;
  const statuses = [];
  for (const cardId of cardClans.keys()) {
    const card = cards.find(item => item.id === cardId);
    assert.ok(card, `missing catalog card ${cardId}`);
    const abilities = engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, 2, `${cardId} sibling ability count changed`);
    const contribution = batchDefinitions.find(definition => definition.cardId === cardId);
    const ability = abilities.find(item => item.id === contribution.id);
    assert.ok(ability?.definition, `CONT ability not registered for ${cardId}`);
    assert.equal(ability.printedText, contribution.printedText, `printed text mismatch for ${cardId}`);
    const sibling = abilities.find(item => item.id === `${cardId}:1`);
    assert.ok(sibling, `missing sibling ability ${cardId}:1`);
    assert.ok(!batchDefinitions.some(definition => definition.id === sibling.id), `batch must not duplicate sibling ${sibling.id}`);
    statuses.push(`${sibling.id} ${sibling.definition ? "compiled" : "unsupported"}`);
  }
  const { auditCatalog } = require("./scripts/audit-ability-catalog.js");
  const report = auditCatalog(cards);
  assert.equal(report.invalidCompiled.length, 0, JSON.stringify(report.invalidCompiled.slice(0, 3)));
  console.log(`Catalog sibling audit: ${statuses.join("; ")}`);
  console.log(`Catalog audit: ${report.compiled}/${report.abilityBlocks} abilities compiled; ${report.invalidCompiled.length} invalid compiled definitions.`);
}

test("continuous engine applies same-clan field penalties only to the exact controller field", runEngineCases);
test("authoritative reducer preserves same-clan field penalties for both seats", runReducerCases);
test("card catalog text and sibling ability coverage remain honest", runCatalogAudit);
