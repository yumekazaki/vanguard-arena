"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0010.js");

const expected = [
  "cfa-10263:0", "cfa-10263:1", "cfa-10264:0", "cfa-10265:0", "cfa-10266:0",
  "cfa-10267:0", "cfa-10268:0", "cfa-10269:0", "cfa-10270:0", "cfa-10271:0",
  "cfa-10273:0", "cfa-10274:0", "cfa-10275:0", "cfa-10276:0", "cfa-10276:1",
  "cfa-10277:0", "cfa-10277:1", "cfa-10278:0", "cfa-10279:0", "cfa-10279:1",
  "cfa-1027:0", "cfa-1027:1", "cfa-10280:0", "cfa-10281:0", "cfa-10282:0",
  "cfa-10284:0", "cfa-10285:0", "cfa-10286:0", "cfa-10287:0", "cfa-1028:0"
];
const supportedIds = ["cfa-1027:1"];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
  abilities.set(ability.id, { card, ability });
}

function instance(cardId, uid, playerId) {
  const card = catalogById.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name, ownerPlayerId: playerId,
    controllerPlayerId: playerId, grade: Number(card?.grade), power: Number(card?.power || 10000),
    critical: 1, unitCard: true, rested: false, locked: false };
}

function attackFixture(side) {
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const defenderSide = side === "human" ? "bot" : "human";
  const defenderPlayerId = defenderSide === "human" ? "host-player" : "guest-player";
  const source = instance("cfa-1027", `polaris-${side}`, sourcePlayerId);
  const target = instance("cfa-3", `target-${side}`, defenderPlayerId);
  const own = { playerId: sourcePlayerId, vanguard: source, rear: Array(5).fill(null), soul: [], hand: [],
    deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  const opponent = { playerId: defenderPlayerId, vanguard: target, rear: Array(5).fill(null), soul: [], hand: [],
    deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  const battleId = `polaris-battle-${side}`;
  const state = { matchId: `polaris-${side}`, stateVersion: 1, eventSequence: 0, turn: 3, side, phase: 5,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null,
    pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: sourcePlayerId,
      attackerZone: "vanguard", defenderSide, targetUid: target.uid, targetZone: "vanguard",
      power: source.power, critical: 1 },
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: sourcePlayerId,
    turnPlayerId: sourcePlayerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId,
    sourceControllerPlayerId: sourcePlayerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: sourcePlayerId, subjectControllerPlayerId: sourcePlayerId,
    attackingCardInstanceIds: [source.uid], previousLocation: "vanguard", currentLocation: "vanguard",
    targetCardInstanceIds: [target.uid], targetLocation: "vanguard", battleId, phase: "battle",
    timingWindow: "attack-declared" });
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  return { state, event, source, target, side, sourcePlayerId, defenderSide, seats };
}

test("batch 0010 accounts for exactly the reserved 30 abilities across 25 assigned cards", () => {
  const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"))
    .assignments.find(item => item.batchId === "ABILITY-320008F1-0010");
  const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8"))
    .batches.find(item => item.batchId === "ABILITY-320008F1-0010");
  assert.ok(assignment && batch);
  assert.ok((assignment.status === "in-progress" && assignment.workerOwner === "worker-ability-batch-0010") ||
    (assignment.status === "reserved" && assignment.workerOwner === "primary-session"));
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.equal(batch.status, assignment.status);
  assert.equal(batch.workerOwner, assignment.workerOwner);
  assert.deepEqual(batch.abilityIds, assignment.abilityIds);
  assert.equal(batch.cardIds.length, new Set(assignment.abilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size);
  assert.equal(contribution.audit.batchId, "ABILITY-320008F1-0010");
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, supportedIds);
  assert.equal(contribution.audit.unsupportedSiblings.length, 29);
  assert.equal(contribution.audit.cards.length, 25);
  assert.equal(contribution.length, 0);
});

test("exact catalog wording is preserved and every unsupported ability fails closed", () => {
  const supported = new Set(contribution.audit.alreadySupportedAbilityIds);
  const blockers = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + blockers.size, expected.length);
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} parses from the assigned card`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} exact catalog text is retained`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    if (supported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has a production definition`);
      assert.equal(Engine.getReviewedAbilityDefinitionsForCard(found.ability.cardId).some(item => item.id === abilityId), true);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), true, `${abilityId} is trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), true, `${abilityId} has a server handler`);
      continue;
    }
    const blocked = blockers.get(abilityId);
    assert.ok(blocked, `${abilityId} has an explicit blocker`);
    assert.equal(blocked.kind, found.ability.kind);
    assert.equal(blocked.catalogPrintedText, found.ability.printedText);
    assert.ok(blocked.blocker.length > 100, `${abilityId} describes its missing mechanic or legality check`);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), false, `${abilityId} is not trusted`);
    assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} cannot resolve as a production effect`);
    if (!found.ability.definition && found.ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(found.ability).ok, false, `${abilityId} does not become eligible by heuristic alone`);
    }
    if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, abilityId);
    if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, abilityId);
  }
});

test("the existing Polaris AUTO is trusted and resolves its own Vanguard attack for either player", () => {
  const ability = abilities.get("cfa-1027:1").ability;
  assert.equal(ability.printedText, "AUTO [VC]: When this unit attacks a vanguard, this unit gets power +3000 until end of battle.");
  assert.equal(ability.definition.source.patternId, "auto-own-attack-vanguard-power-battle-v1");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", circles: [], targetLocation: "vanguard" });
  assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]);

  for (const side of ["human", "bot"]) {
    const f = attackFixture(side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.ok(discovery.queued.some(item => item.ability?.id === ability.id || item.abilityId === ability.id), `${side} attack queues Polaris`);
    assert.equal(f.state.pendingAbility.side, side, `${side} owns its prompt`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side} exact source instance`);
    const actorAuthUid = side === "human" ? f.seats.hostAuthUid : f.seats.guestAuthUid;
    const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid,
      actionId: `resolve-${side}-polaris`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: ability.id } } }, f.seats, Engine);
    assert.equal(result.ok, true, `${side} resolution: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(f.source.power) + 3000, `${side} battle power`);
  }
});

test("Cyneblugar's parser candidate is not mistaken for an authoritative production definition", () => {
  const ability = abilities.get("cfa-10269:0").ability;
  assert.equal(ability.definition?.source?.patternId, "cont-rc-opponent-vanguard-grade-power-v1");
  assert.equal(Engine.getReviewedAbilityDefinitionsForCard("cfa-10269").some(item => item.id === ability.id), false);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), false);
  assert.equal(Engine.isManuallyActivatable(ability), false);
  const official = contribution.audit.unsupportedSiblings.find(item => item.abilityId === ability.id);
  assert.equal(official.officialCardNumber, "D-BT07/081EN");
  assert.equal(official.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F081EN");
});

test("official source checks retain Polaris and Cyneblugar text without replacing catalog text", () => {
  assert.equal(contribution.audit.officialTextChecked, true);
  assert.deepEqual([...contribution.audit.officiallyCheckedAbilityIds].sort(), ["cfa-10269:0", "cfa-1027:1"]);
  for (const abilityId of contribution.audit.officiallyCheckedAbilityIds) {
    const row = abilityId === "cfa-1027:1"
      ? contribution.audit.supportedProductionDefinitions.find(item => item.abilityId === abilityId)
      : contribution.audit.unsupportedSiblings.find(item => item.abilityId === abilityId);
    assert.ok(row);
    assert.match(row.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
    assert.ok(row.officialPrintedText);
    assert.ok(row.officialCardNumber);
  }
  assert.equal(abilities.get("cfa-1027:1").card.name, "Battle of the Twin Brush, Polaris");
  assert.equal(abilities.get("cfa-10269:0").card.text.includes(abilities.get("cfa-10269:0").ability.printedText), true);
});
