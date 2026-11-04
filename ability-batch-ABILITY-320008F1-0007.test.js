"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0007.js");

const BATCH_ID = "ABILITY-320008F1-0007";
const expected = [
  "cfa-10165:0", "cfa-10165:1", "cfa-10166:0", "cfa-10166:1", "cfa-10167:0",
  "cfa-10168:0", "cfa-10170:0", "cfa-10171:0", "cfa-10172:0", "cfa-10172:1",
  "cfa-10173:0", "cfa-10173:1", "cfa-10174:0", "cfa-10175:0", "cfa-1017:0",
  "cfa-1017:1", "cfa-10181:0", "cfa-10181:1", "cfa-10182:0", "cfa-10183:0",
  "cfa-10184:0", "cfa-10185:0", "cfa-10186:0", "cfa-10186:1", "cfa-10187:0",
  "cfa-10188:0", "cfa-10189:0", "cfa-10189:1", "cfa-1018:0", "cfa-1018:1",
  "cfa-10190:0", "cfa-10191:0", "cfa-10191:1", "cfa-10196:0", "cfa-10196:1",
  "cfa-1019:0", "cfa-1019:1"
];
const expectedSupported = [
  "cfa-10174:0", "cfa-1017:0", "cfa-1017:1", "cfa-10182:0", "cfa-10183:0",
  "cfa-10186:0", "cfa-10186:1", "cfa-10187:0", "cfa-10188:0", "cfa-1018:0",
  "cfa-10191:0", "cfa-10191:1", "cfa-10196:0", "cfa-10196:1", "cfa-1019:1"
];
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"))
  .assignments.find(item => item.batchId === BATCH_ID);
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8"))
  .batches.find(item => item.batchId === BATCH_ID);
const supportedById = new Map(contribution.audit.supportedDefinitions.map(item => [item.abilityId, item]));
const unsupportedById = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function parsedAbility(abilityId) {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `ability ${abilityId} exists in local catalog`);
  return { card, ability };
}

function attackFixture(side = "human", { unrelatedSource = false } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const definition = cardsById.get("cfa-1017");
  const source = {
    uid: `batch-0007-barking-${side}`, cardId: "cfa-1017", cardName: definition.name,
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: "Pale Moon", clans: ["Pale Moon"],
    type: "Unit", unitCard: true, grade: 2, power: 9000
  };
  const vanguard = { uid: `batch-0007-own-vg-${side}`, cardId: "fixture-vg", cardName: "Pale Moon Vanguard",
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: "Pale Moon", clans: ["Pale Moon"], type: "Unit", unitCard: true, grade: 3, power: 13000 };
  const opponentVanguard = { uid: `batch-0007-opp-vg-${side}`, cardId: "fixture-opp-vg", cardName: "Opponent Vanguard",
    ownerPlayerId: opponentId, controllerPlayerId: opponentId, type: "Unit", unitCard: true, grade: 3, power: 13000 };
  const discard = { uid: `batch-0007-discard-${side}`, cardId: "fixture-pale-moon", cardName: "Pale Moon cost",
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: "Pale Moon", clans: ["Pale Moon"], type: "Unit", unitCard: true };
  const own = { playerId: ownerId, vanguard, rear: [source, null, null, null, null], hand: [discard], drop: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], deck: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], deck: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `batch-0007-${side}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 5, side,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
    pendingAttack: { battleId: `batch-0007-attack-${side}`, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId,
      attackerZone: "rear-left", defenderSide: opponentSide, targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 },
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: unrelatedSource ? "different-attacker" : source.uid,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: unrelatedSource ? "different-attacker" : source.uid,
    subjectCardInstanceId: unrelatedSource ? "different-attacker" : source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [unrelatedSource ? "different-attacker" : source.uid],
    previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left",
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: state.pendingAttack.battleId,
    phase: "battle", timingWindow: "attack-declared"
  });
  return { state, source, discard, ownerId, side, event };
}

function resolveAttack(fixture, actorAuthUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid,
    actionId: `batch-0007-resolve-${fixture.side}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: "cfa-1017:1", costSelections: { discard: [fixture.discard.uid] }
    } }
  }, seats, Engine);
}

test("the assignment, batch, and contribution cover exactly 37 abilities on 25 cards", () => {
  assert.ok(assignment && batch);
  assert.equal(assignment.status, "reserved");
  assert.equal(assignment.workerOwner, "primary-session");
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.deepEqual(batch.abilityIds, assignment.abilityIds);
  assert.equal(batch.cardIds.length, new Set(assignment.abilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size);
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, expectedSupported);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.proposedDefinitions, []);
  assert.equal(contribution.length, 0);
  assert.equal(supportedById.size, 15);
  assert.equal(unsupportedById.size, 22);
});

test("each assigned ID preserves its exact catalog wording and is supported or concretely blocked", () => {
  assert.equal(supportedById.size + unsupportedById.size, expected.length);
  for (const id of expected) {
    const { card, ability } = parsedAbility(id);
    assert.ok(card.text.includes(ability.printedText), `${id}: exact source text remains in catalog`);
    assert.equal(ability.cardId, id.slice(0, id.lastIndexOf(":")));
    if (supportedById.has(id)) {
      const record = supportedById.get(id);
      assert.equal(record.catalogPrintedText, ability.printedText, `${id}: supported text`);
      assert.ok(record.patternId, `${id}: production pattern is identified`);
      if (["AUTO", "ACT"].includes(ability.kind)) {
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, `${id}: authoritative definition`);
        assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${id}: authoritative effect handler`);
      } else {
        assert.equal(ability.kind, "CONT", `${id}: only passive CONT definitions use this branch`);
        assert.equal(Engine.isManuallyActivatable(ability), false, `${id}: continuous text is not an ACT prompt`);
        assert.ok(ability.definition.keywords?.length || ability.definition.effects?.length || ability.definition.continuousRestrictions?.length, `${id}: structured passive rule`);
      }
    } else {
      const blocker = unsupportedById.get(id);
      assert.ok(blocker, `${id}: has a blocker record`);
      assert.equal(blocker.kind, ability.kind);
      assert.equal(blocker.catalogPrintedText, ability.printedText);
      assert.equal(blocker.officialPrintedText, null, `${id}: official text is not falsely claimed`);
      assert.ok(blocker.blocker.length > 80, `${id}: blocker names the missing rule mechanic`);
      assert.equal(ability.definition, null, `${id}: no placeholder definition is registered`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id}: uncompiled effect is unavailable`);
      if (ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(ability).ok, false, id);
      if (ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(ability, {}).ok, false, id);
      if (ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(ability), false, id);
    }
  }
});

test("the compiled CONT effects remain passive and the checked opponent-grade power respects timing and circle", () => {
  for (const id of ["cfa-10186:0", "cfa-10191:0", "cfa-10196:0", "cfa-1019:1"]) {
    const { card, ability } = parsedAbility(id);
    assert.equal(ability.kind, "CONT", id);
    assert.equal(Engine.isManuallyActivatable(ability), false, id);
    if (id === "cfa-1019:1") {
      assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "lord" }], id);
    } else {
      assert.deepEqual(ability.definition.keywords, ["sentinel"], id);
      assert.equal(Engine.hasAbilityKeyword([ability], "sentinel"), true, id);
      assert.equal(Engine.hasAbilityKeyword(card, "sentinel"), true, id);
    }
  }
  const { ability } = parsedAbility("cfa-10183:0");
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 5000);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 2, isControllerTurn: true }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: false }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 0);
});

test("the supported Pale Moon own-attack AUTO prompts and resolves for its controller only on either seat", () => {
  const ability = parsedAbility("cfa-1017:1").ability;
  assert.equal(ability.trigger.eventType, "unit.attacked");
  assert.equal(ability.trigger.subject, "source");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.costs, [{ type: "discard", count: 1, filter: { clan: "Pale Moon" } }]);
  for (const side of ["human", "bot"]) {
    const f = attackFixture(side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}: exact source attack queues once`);
    assert.equal(f.state.pendingAbility.side, side, `${side}: owning player gets the decision`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side}: exact instance owns the AUTO`);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${side}: replay does not duplicate`);
    const otherSeat = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(resolveAttack(f, otherSeat).ok, false, `${side}: opponent cannot proxy the cost or resolution`);
    const result = resolveAttack(f);
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolves"}`);
    assert.deepEqual(f.state.players[side].hand, [], `${side}: controller's matching card pays the cost`);
    assert.equal(f.state.players[side].drop[0].uid, f.discard.uid, `${side}: cost card moves to own Drop`);
    assert.equal(f.state.pendingAttack.power, 13000, `${side}: exact attack receives its printed +3000`);
  }
  const unrelated = attackFixture("human", { unrelatedSource: true });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0, "another unit's attack cannot trigger this source");
});
