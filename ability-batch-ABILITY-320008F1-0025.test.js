"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0025.js");
Engine.registerAbilityDefinitions(contribution);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-320008F1-0025";
const EXPECTED = [
  "cfa-10665:0", "cfa-10665:1", "cfa-10666:0", "cfa-10667:0", "cfa-10669:0",
  "cfa-10670:0", "cfa-10671:0", "cfa-10672:0", "cfa-10673:0", "cfa-10674:0",
  "cfa-10675:0", "cfa-10676:0", "cfa-10677:0", "cfa-10678:0", "cfa-10679:0",
  "cfa-10679:1", "cfa-1067:0", "cfa-1067:1", "cfa-10680:0", "cfa-10681:0",
  "cfa-10682:0", "cfa-10684:0", "cfa-10685:0", "cfa-10686:0", "cfa-10686:1",
  "cfa-10687:0", "cfa-10688:0", "cfa-10689:0", "cfa-10689:1", "cfa-1068:0",
  "cfa-1068:1"
];
const NEW_IDS = ["cfa-10680:0", "cfa-10681:0"];
const OPEN_EXPECTED = EXPECTED.filter(id => !NEW_IDS.includes(id));
const partners = new Map([
  ["cfa-10680:0", { sourceName: "Burly Axe Beetle", partnerName: "Bulky Saw Stag" }],
  ["cfa-10681:0", { sourceName: "Bulky Saw Stag", partnerName: "Burly Axe Beetle" }]
]);
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const assignmentRegistry = require("./ability-work-assignments.json");
const assignment = assignmentRegistry.assignments.find(item => item.batchId === BATCH_ID);
const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === BATCH_ID);
const audit = contribution.audit;
const alreadySupported = new Set(audit.alreadySupportedAbilityIds);
const unsupportedById = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function parsedAbility(abilityId) {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ability ${abilityId} exists`);
  return { card, ability };
}

function evaluate(ability, { location = "rear-guard", targetUid = "source", isControllerTurn = true, field = [] } = {}) {
  return Engine.evaluateContinuousEffects([ability], {
    sourceLocation: location,
    sourceInstanceId: "source",
    targetInstanceId: targetUid,
    isControllerTurn,
    controllerFieldCards: field
  }).power;
}

function makePlayer(playerId, vanguard, rear) {
  return { playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] };
}

function attackFixture({ abilityId, side, matchingController }) {
  const otherSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const expectedPartner = partners.get(abilityId).partnerName;
  const source = {
    uid: `source-${side}-${abilityId}`,
    cardId: abilityId.slice(0, abilityId.lastIndexOf(":")),
    cardName: partners.get(abilityId).sourceName,
    names: [partners.get(abilityId).sourceName],
    type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId
  };
  const vanguard = { uid: `vg-${side}`, cardId: `vg-${side}`, cardName: "Friendly Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const opposingVanguard = { uid: `opposing-vg-${side}`, cardId: `opposing-vg-${side}`, cardName: "Opponent Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  const partner = { uid: `partner-${side}-${abilityId}`, cardId: `partner-${abilityId}`, cardName: expectedPartner, names: [expectedPartner], type: "Normal Unit", unitCard: true, grade: 3, power: 13000, ownerPlayerId: matchingController === side ? playerId : opponentId, controllerPlayerId: matchingController === side ? playerId : opponentId };
  const players = {
    human: makePlayer(side === "human" ? playerId : opponentId, side === "human" ? vanguard : opposingVanguard, []),
    bot: makePlayer(side === "bot" ? playerId : opponentId, side === "bot" ? vanguard : opposingVanguard, [])
  };
  players[side].rear = [source, ...(matchingController === side ? [partner] : []), null, null, null];
  players[otherSide].rear = matchingController === otherSide ? [partner] : [];
  const state = {
    matchId: `batch-0025-${side}-${abilityId}-${matchingController}`,
    stateVersion: 0,
    eventSequence: 0,
    turn: 2,
    side,
    phase: 5,
    firstTurnComplete: true,
    processedActionIds: [],
    pendingAttack: null,
    pendingAbility: null,
    pendingAbilities: [],
    pendingTrigger: null,
    players
  };
  return { state, source, partner, opposingVanguard, side };
}

function resolveAttack(fixture) {
  const actorAuthUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid,
    actionId: `attack-${fixture.state.matchId}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: fixture.source.uid, targetCardInstanceId: fixture.opposingVanguard.uid }
  }, seats, Engine);
}

test("batch assignment exactly matches 31 unique ability IDs and every ability is classified once", () => {
  assert.ok(assignment && batch);
  assert.equal(assignment.status, "in-progress");
  assert.equal(assignment.workerOwner, "agent-batch-0025");
  assert.equal(batch.status, "in-progress");
  assert.equal(batch.workerOwner, "agent-batch-0025");
  assert.deepEqual([...assignment.abilityIds].sort(), [...OPEN_EXPECTED].sort());
  assert.deepEqual([...batch.abilityIds].sort(), [...OPEN_EXPECTED].sort());
  assert.deepEqual([...assignment.completedAbilityIds].sort(), [...NEW_IDS].sort());
  assert.deepEqual([...assignment.completedCardIds].sort(), ["cfa-10680", "cfa-10681"]);
  assert.deepEqual([...audit.abilityIds].sort(), [...EXPECTED].sort());
  assert.equal(new Set(EXPECTED).size, 31);
  assert.deepEqual(contribution.map(definition => definition.id).sort(), [...NEW_IDS].sort());
  assert.equal(audit.alreadySupportedAbilityIds.length, 8);
  assert.equal(audit.implementedAbilityIds.length, 2);
  assert.equal(audit.unsupportedSiblings.length, 21);
  assert.equal(audit.alreadySupportedAbilityIds.length + audit.implementedAbilityIds.length + audit.unsupportedSiblings.length, 31);
  assert.deepEqual([...unsupportedById.keys()].sort(), EXPECTED.filter(id => !alreadySupported.has(id) && !NEW_IDS.includes(id)).sort());
  assert.equal(audit.officialTextUnlocatedAbilityIds.includes("cfa-10680:0"), true);
  assert.equal(audit.officialTextUnlocatedAbilityIds.includes("cfa-10681:0"), true);
  assert.deepEqual(audit.verifiedOfficialAbilities, [], "no ability is falsely marked as wholly verified");
});

test("all assigned IDs retain exact local catalog text and are implemented, already supported, or concretely blocked", () => {
  for (const abilityId of EXPECTED) {
    const { card, ability } = parsedAbility(abilityId);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: exact printed block appears in full local card text`);
    const supportedRecord = audit.supportedDefinitions.find(item => item.abilityId === abilityId);
    if (NEW_IDS.includes(abilityId)) {
      const definition = contribution.find(item => item.id === abilityId);
      assert.ok(definition, `${abilityId}: proposed definition exists`);
      assert.equal(definition.cardId, String(card.id));
      assert.equal(definition.kind, ability.kind);
      assert.equal(definition.printedText, ability.printedText);
      assert.equal(definition.requiredLocation[0], "rear-guard");
      assert.equal(definition.effects[0].amount, 10000);
      assert.equal(definition.effects[0].duration, "continuous");
      assert.equal(definition.effects[0].target, "source");
      assert.ok(supportedRecord);
      assert.deepEqual(supportedRecord.definition, definition);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, "CONT is evaluated continuously, not dispatched as an AUTO/ACT effect");
      assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId}: CONT cannot be manually activated`);
    } else if (alreadySupported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId}: existing definition remains compiled`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, String(card.id));
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.ok(supportedRecord);
      assert.deepEqual(supportedRecord.definition, ability.definition);
      if (["AUTO", "ACT"].includes(ability.kind)) {
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, `${abilityId}: exact trusted server ability`);
        assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${abilityId}: exact server effects`);
      } else {
        assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId}: CONT remains passive`);
      }
    } else {
      const record = unsupportedById.get(abilityId);
      assert.equal(ability.definition, null, `${abilityId}: no placeholder definition`);
      assert.ok(record?.blocker?.length > 90, `${abilityId}: explicit blocker`);
      assert.equal(record.catalogPrintedText, ability.printedText);
      assert.equal(record.officialPrintedText, null);
      assert.equal(record.officialReference, null);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${abilityId}: unsupported ability is not server-trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId}: unsupported ability is not resolvable`);
    }
  }
  assert.deepEqual(audit.supportedDefinitions.map(item => item.abilityId).sort(), [...alreadySupported, ...NEW_IDS].sort());
  assert.deepEqual(audit.proposedDefinitions.map(item => item.id).sort(), [...NEW_IDS].sort());
  const report = auditCatalog(catalog);
  assert.deepEqual(report.invalidCompiled, [], "the catalog audit accepts both contribution definitions");
});

test("paired named Rear-Guard CONT power applies only on the controller's turn, at RC, to the exact source", () => {
  for (const abilityId of NEW_IDS) {
    const { ability } = parsedAbility(abilityId);
    const partnerName = partners.get(abilityId).partnerName;
    const matching = { uid: `matching-${abilityId}`, zone: "rear-guard", names: [partnerName], controllerPlayerId: "player" };
    const wrongName = { uid: `wrong-${abilityId}`, zone: "rear-guard", names: [`Not ${partnerName}`], controllerPlayerId: "player" };
    const wrongZone = { uid: `zone-${abilityId}`, zone: "vanguard", names: [partnerName], controllerPlayerId: "player" };
    assert.equal(evaluate(ability, { field: [matching] }), 10000, `${abilityId}: friendly named RC grants power`);
    assert.equal(evaluate(ability, { field: [wrongName] }), 0, `${abilityId}: wrong name fails`);
    assert.equal(evaluate(ability, { field: [wrongZone] }), 0, `${abilityId}: named Vanguard does not satisfy RC condition`);
    assert.equal(evaluate(ability, { field: [] }), 0, `${abilityId}: opponent's field is not part of the controller field`);
    assert.equal(evaluate(ability, { isControllerTurn: false, field: [matching] }), 0, `${abilityId}: inactive during opponent turn`);
    assert.equal(evaluate(ability, { location: "vanguard", field: [matching] }), 0, `${abilityId}: source must itself be on RC`);
    assert.equal(evaluate(ability, { targetUid: "different-instance", field: [matching] }), 0, `${abilityId}: source-target instance mismatch fails`);
  }
});

test("authoritative attack power applies each paired ability independently for either seat and ignores opponent-only names", () => {
  for (const side of ["human", "bot"]) for (const abilityId of NEW_IDS) {
    const friendly = resolveAttack(attackFixture({ abilityId, side, matchingController: side }));
    assert.equal(friendly.ok, true, `${side}/${abilityId}: legal attack resolves`);
    assert.equal(friendly.state.pendingAttack.power, 23000, `${side}/${abilityId}: matching friendly RC is counted`);

    const opposingSide = side === "human" ? "bot" : "human";
    const opposingOnly = resolveAttack(attackFixture({ abilityId, side, matchingController: opposingSide }));
    assert.equal(opposingOnly.ok, true, `${side}/${abilityId}: attack with only an opponent match resolves`);
    assert.equal(opposingOnly.state.pendingAttack.power, 13000, `${side}/${abilityId}: opponent's matching Rear-Guard cannot satisfy condition`);
  }
});
