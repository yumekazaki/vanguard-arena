"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0005.js");
const productionDefinitions = new Map();
for (const cardId of ["cfa-10115", "cfa-10118", "cfa-10129", "cfa-10133"]) {
  productionDefinitions.set(cardId, Engine.getReviewedAbilityDefinitionsForCard(cardId).map(item => item.id));
}

const BATCH_ID = "ABILITY-320008F1-0005";
const expected = [
  "cfa-10115:0", "cfa-10117:0", "cfa-10118:0", "cfa-10118:1", "cfa-10120:0",
  "cfa-10120:1", "cfa-10120:2", "cfa-10121:0", "cfa-10121:1", "cfa-10122:0",
  "cfa-10122:1", "cfa-10123:0", "cfa-10123:1", "cfa-10124:0", "cfa-10125:0",
  "cfa-10125:1", "cfa-10126:0", "cfa-10126:1", "cfa-10127:0", "cfa-10127:1",
  "cfa-10128:0", "cfa-10129:0", "cfa-1012:0", "cfa-1012:1", "cfa-10130:0",
  "cfa-10131:0", "cfa-10131:1", "cfa-10132:0", "cfa-10133:0", "cfa-10133:1",
  "cfa-10134:0", "cfa-10134:1", "cfa-10135:0", "cfa-10136:0", "cfa-10137:0",
  "cfa-10138:0", "cfa-10139:0", "cfa-10139:1", "cfa-1013:0"
];
const proposedIds = ["cfa-10115:0", "cfa-10118:1", "cfa-10133:1"];
const integratedIds = ["cfa-10115:0", "cfa-10118:1", "cfa-10129:0", "cfa-10133:1"];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) abilities.set(ability.id, { card, ability });
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments.find(item => item.batchId === BATCH_ID);
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches.find(item => item.batchId === BATCH_ID);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let serial = 0;

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
}

function instance(cardId, uid, playerId, extra = {}) {
  const card = cards.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name || String(cardId), type: "Unit",
    grade: Number(card?.grade || 0), power: Number(card?.power || 0), critical: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true,
    faceUp: true, rested: false, locked: false, ...extra
  };
}

function baseFixture(side) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const players = { human: player("player-host"), bot: player("player-guest") };
  const state = {
    matchId: `ability-320008f1-0005-${side}-${++serial}`, stateVersion: 1, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    side, turn: 4, phase: "main", players
  };
  return { state, own: players[side], opponent: players[opponentSide], side, opponentSide, ownId, opponentId };
}

function eventFor(state, options) {
  return Engine.createGameEvent(state, options);
}

function response(f, abilityId, selection = {}, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid,
    actionId: `resolve-${abilityId}-${f.state.matchId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId, ...selection } }
  }, seats, Engine);
}

function vanguardAttackFixture(side, opponentRearCount = 2, attackerIsVanguard = true) {
  const f = baseFixture(side);
  f.source = instance("cfa-10115", `heat-stamping-${f.side}-${serial}`, f.ownId, { circle: "rear-left" });
  f.attacker = instance(attackerIsVanguard ? "cfa-3" : "cfa-1", `attacker-${f.side}-${serial}`, f.ownId, {
    circle: attackerIsVanguard ? "vanguard" : "rear-right", rested: true, power: 13000
  });
  f.opponentVanguard = instance("cfa-3", `opponent-vanguard-${f.side}-${serial}`, f.opponentId, { circle: "vanguard" });
  f.own.vanguard = attackerIsVanguard ? f.attacker : instance("cfa-3", `own-vanguard-${f.side}-${serial}`, f.ownId, { circle: "vanguard", power: 13000 });
  f.own.rear[0] = f.source;
  if (!attackerIsVanguard) f.own.rear[1] = f.attacker;
  f.opponent.vanguard = f.opponentVanguard;
  for (let index = 0; index < opponentRearCount; index++) f.opponent.rear[index] = instance("cfa-1", `opp-rear-${index}-${f.side}-${serial}`, f.opponentId, { circle: index === 0 ? "rear-left" : "rear-right" });
  f.state.phase = "battle";
  f.state.pendingAttack = {
    battleId: `attack-${f.side}-${serial}`, attackerUid: f.attacker.uid, attackerSide: f.side,
    attackerPlayerId: f.ownId, attackerZone: attackerIsVanguard ? "vanguard" : "rear-right",
    defenderSide: f.opponentSide, targetUid: f.opponentVanguard.uid, targetZone: "vanguard",
    power: f.attacker.power, targetPower: f.opponentVanguard.power, critical: 1
  };
  f.event = eventFor(f.state, {
    type: "unit.attacked", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.attacker.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: f.attacker.uid, subjectCardInstanceId: f.attacker.uid,
    subjectOwnerPlayerId: f.ownId, subjectControllerPlayerId: f.ownId,
    previousLocation: f.state.pendingAttack.attackerZone, currentLocation: f.state.pendingAttack.attackerZone,
    targetCardInstanceIds: [f.opponentVanguard.uid], targetLocation: "vanguard",
    battleId: f.state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared"
  });
  return f;
}

function placementFixture(side, hasSoul = true) {
  const f = baseFixture(side);
  f.source = instance("cfa-10118", `menacing-tiger-${f.side}-${serial}`, f.ownId, { circle: "rear-left" });
  f.own.vanguard = instance("cfa-3", `placement-vanguard-${f.side}-${serial}`, f.ownId, { circle: "vanguard", power: 13000 });
  f.own.rear[0] = f.source;
  f.opponent.vanguard = instance("cfa-3", `placement-opponent-${f.side}-${serial}`, f.opponentId, { circle: "vanguard" });
  if (hasSoul) f.own.soul.push(instance("cfa-1", `soul-cost-${f.side}-${serial}`, f.ownId, { zone: "soul" }));
  f.event = eventFor(f.state, {
    type: "card.placed", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid,
    subjectOwnerPlayerId: f.ownId, subjectControllerPlayerId: f.ownId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", targetLocation: "rear-left",
    phase: "main", timingWindow: "unit-placement"
  });
  return f;
}

function discardedSourceFixture(side, hasCounterBlast = true) {
  const f = baseFixture(side);
  f.state.phase = "main";
  f.source = instance("cfa-10118", `discarded-tiger-${f.side}-${serial}`, f.ownId, { zone: "drop" });
  f.own.drop.push(f.source);
  f.own.vanguard = instance("cfa-3", `discard-vanguard-${f.side}-${serial}`, f.ownId, { circle: "vanguard" });
  f.opponent.vanguard = instance("cfa-3", `discard-opponent-${f.side}-${serial}`, f.opponentId, { circle: "vanguard" });
  if (hasCounterBlast) f.own.damage.push(instance("cfa-1", `cb-cost-${f.side}-${serial}`, f.ownId, { faceDown: false }));
  f.event = eventFor(f.state, {
    type: "card.discarded", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid,
    subjectOwnerPlayerId: f.ownId, subjectControllerPlayerId: f.ownId,
    previousLocation: "hand", currentLocation: "drop", phase: "main", timingWindow: "hand-discard"
  });
  return f;
}

function boostFixture(side) {
  const f = baseFixture(side);
  f.source = instance("cfa-10129", `flutter-dragon-${f.side}-${serial}`, f.ownId, { circle: "rear-left", rested: true, power: 7000 });
  f.attacker = instance("cfa-3", `boosted-vanguard-${f.side}-${serial}`, f.ownId, { circle: "vanguard", rested: true, power: 13000 });
  f.opponent.vanguard = instance("cfa-3", `boost-opponent-${f.side}-${serial}`, f.opponentId, { circle: "vanguard", power: 10000 });
  f.own.vanguard = f.attacker;
  f.own.rear[0] = f.source;
  const battleId = `boost-battle-${f.side}-${serial}`;
  f.state.phase = "battle";
  f.state.pendingAttack = {
    battleId, attackerUid: f.attacker.uid, attackerSide: f.side, attackerPlayerId: f.ownId,
    attackerZone: "vanguard", defenderSide: f.opponentSide, targetUid: f.opponent.vanguard.uid,
    targetZone: "vanguard", power: f.attacker.power, targetPower: f.opponent.vanguard.power,
    boostUid: f.source.uid, boostPower: 5000, critical: 1
  };
  f.event = eventFor(f.state, {
    type: "unit.boosted", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid,
    subjectOwnerPlayerId: f.ownId, subjectControllerPlayerId: f.ownId,
    boosterCardInstanceId: f.source.uid, boostedCardInstanceId: f.attacker.uid,
    previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left",
    targetLocation: "vanguard", targetCardInstanceIds: [f.attacker.uid], battleId,
    phase: "battle", timingWindow: "boost-step", after: { rested: true }
  });
  return f;
}

function riddenCallFixture(side, riderCardId = "cfa-664", rideSourceMatches = true) {
  const f = baseFixture(side);
  f.source = instance("cfa-10133", `replenish-mage-${f.side}-${serial}`, f.ownId, { zone: "soul" });
  f.rider = instance(riderCardId, `rider-${f.side}-${serial}`, f.ownId, { circle: "vanguard" });
  f.own.vanguard = f.rider;
  f.own.soul.push(f.source);
  f.opponent.vanguard = instance("cfa-3", `ride-opponent-${f.side}-${serial}`, f.opponentId, { circle: "vanguard" });
  const targetCardInstanceIds = rideSourceMatches ? [f.source.uid] : [`other-ridden-card-${f.side}-${serial}`];
  f.event = eventFor(f.state, {
    type: "card.ridden", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.rider.uid, sourceCardName: f.rider.cardName, sourceCardGrade: f.rider.grade,
    sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: f.rider.uid, subjectCardInstanceId: f.rider.uid,
    subjectOwnerPlayerId: f.ownId, subjectControllerPlayerId: f.ownId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds,
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride"
  });
  return f;
}

test("the assignment registry, manifest, contribution, and audit cover exactly 39 abilities on 25 cards", () => {
  assert.ok(assignment && batch);
  assert.equal(assignment.status, "reserved");
  assert.equal(assignment.workerOwner, "primary-session");
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.deepEqual(batch.abilityIds, assignment.abilityIds);
  assert.equal(batch.cardIds.length, new Set(assignment.abilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size);
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.originallyProposedDefinitionIds, proposedIds);
  assert.equal(contribution.length, 3);
  assert.deepEqual(contribution.audit.implementedAbilityIds, integratedIds, "only official-text reviewed definitions are integrated");
  assert.deepEqual(contribution.audit.integratedProductionDefinitions.map(item => item.abilityId), ["cfa-10129:0"]);
  assert.deepEqual(contribution.audit.officiallyCheckedAbilityIds, ["cfa-10129:0"]);
  assert.equal(contribution.audit.officialTextChecked, false, "the other batch texts have not all been checked against official sources");
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, ["cfa-1012:0"]);
  assert.equal(contribution.audit.unsupportedSiblings.length, 34);
  assert.equal(contribution.audit.cards.length, 25);
});

test("each assigned ability keeps its exact catalog text and is integrated, supported, or concretely blocked", () => {
  const proposed = new Map(contribution.map(definition => [definition.id, definition]));
  const alreadySupported = new Set(contribution.audit.alreadySupportedAbilityIds);
  const integrated = new Set(contribution.audit.implementedAbilityIds);
  const unsupported = new Map(contribution.audit.unsupportedSiblings.map(record => [record.abilityId, record]));
  assert.equal(integrated.size + alreadySupported.size + unsupported.size, expected.length);
  assert.deepEqual([...proposed.keys()].sort(), proposedIds.slice().sort(), "the original proposal file remains audit evidence");
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} parses from its assigned card`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} text is preserved in the catalog`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    const cardRecord = contribution.audit.cards.find(card => card.cardId === String(found.card.id));
    assert.equal(cardRecord?.name, found.card.name, `${abilityId} card record`);
    if (proposed.has(abilityId)) {
      assert.equal(proposed.get(abilityId).printedText, found.ability.printedText, `${abilityId} proposed text`);
      assert.equal(productionDefinitions.get(found.card.id).includes(abilityId), true, `${abilityId} is integrated in production`);
      assert.equal(found.ability.definition.id, abilityId, `${abilityId} uses its production definition`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), true, `${abilityId} uses an existing server effect handler`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), true, `${abilityId} exact definition is trusted in production`);
      assert.equal(contribution.audit.officiallyCheckedAbilityIds.includes(abilityId), false, `${abilityId} is not mislabeled official-text checked`);
    } else if (integrated.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has the reviewed production definition`);
      assert.equal(productionDefinitions.get(found.card.id).includes(abilityId), true, `${abilityId} is registered in production`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), true, `${abilityId} is trusted in production`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), true, `${abilityId} has a production effect handler`);
      assert.equal(contribution.audit.integratedProductionDefinitions.find(item => item.abilityId === abilityId)?.officialCardNumber, "D-BT06/098EN");
    } else if (alreadySupported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} keeps its production definition`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), true, `${abilityId} is server executable`);
    } else {
      const record = unsupported.get(abilityId);
      assert.ok(record, `${abilityId} has an audit record`);
      assert.equal(record.kind, found.ability.kind);
      assert.equal(record.catalogPrintedText, found.ability.printedText);
      assert.equal(record.officialPrintedText, null, `${abilityId} is not mislabeled official-text checked`);
      assert.ok(record.blocker.length > 60, `${abilityId} has a concrete blocker`);
      assert.equal(found.ability.definition, null, `${abilityId} remains uncompiled`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} remains unavailable to resolution`);
      if (found.ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(found.ability).ok, false, abilityId);
      if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, abilityId);
      if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, abilityId);
    }
  }
});

test("cfa-10115:0 checks the exact controller Vanguard attack and opposing Rear-Guard threshold for both seats", () => {
  const ability = abilities.get("cfa-10115:0").ability;
  assert.equal(ability.trigger.eventType, "unit.attacked");
  assert.equal(ability.trigger.subject, "vanguard");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.conditions, [{ type: "opponent-rear-guards-at-most", count: 2 }]);
  assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.equal(ability.definition.optional, false);
  assert.deepEqual(ability.effects, [{
    op: "modify-power-target", target: "chosen", amount: 10000, duration: "turn",
    targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" }
  }]);
  for (const side of ["human", "bot"]) {
    const f = vanguardAttackFixture(side, 2);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1, `${side}: qualifying Vanguard attack prompts once`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.guestAuthUid : seats.hostAuthUid,
      actionId: `proxy-attack-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-10115:0", targetUid: f.own.vanguard.uid } }
    }, seats, Engine).ok, false, `${side}: opponent seat cannot resolve this AUTO`);
    const resolved = response(f, "cfa-10115:0", { targetUid: f.own.vanguard.uid });
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolves"}`);
    assert.equal(f.own.rear[0], null, `${side}: exact source leaves RC`);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), true, `${side}: exact source pays the cost into Soul`);
    assert.equal(f.own.vanguard.turnPowerBoost, 10000, `${side}: only the controller's Vanguard receives the turn modifier`);
  }
  const tooMany = vanguardAttackFixture("human", 3);
  assert.equal(Reducer.discoverAutoTriggers(tooMany.state, [tooMany.event], Engine).queued.length, 0, "three opposing Rear-Guards fail the threshold");
  const wrongAttacker = vanguardAttackFixture("human", 2, false);
  assert.equal(Reducer.discoverAutoTriggers(wrongAttacker.state, [wrongAttacker.event], Engine).queued.length, 0, "a Rear-Guard attack is not a Vanguard attack");
});

test("cfa-10118:1 pays Soul Blast 1 on its exact RC placement and targets only its controller's Vanguard", () => {
  const ability = abilities.get("cfa-10118:1").ability;
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.equal(ability.trigger.subject, "source");
  assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
  assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }]);
  for (const side of ["human", "bot"]) {
    const f = placementFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${side}: exact RC placement triggers`);
    const soulUid = f.own.soul[0].uid;
    const resolved = response(f, "cfa-10118:1", {
      targetUid: f.own.vanguard.uid,
      costSelections: { cb: [], sb: [soulUid], discard: [], reveal: [] }
    });
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolves"}`);
    assert.equal(f.own.soul.some(card => card.uid === soulUid), false, `${side}: controller paid Soul Blast`);
    assert.equal(f.own.vanguard.turnPowerBoost, 5000, `${side}: friendly Vanguard receives +5000`);
    assert.equal(f.opponent.vanguard.turnPowerBoost || 0, 0, `${side}: opponent's Vanguard is unchanged`);
  }
  const noSoul = placementFixture("human", false);
  assert.equal(Reducer.discoverAutoTriggers(noSoul.state, [noSoul.event], Engine).queued.length, 0, "an unavailable Soul Blast cost does not prompt");
  const invalidTarget = placementFixture("human");
  assert.equal(Reducer.discoverAutoTriggers(invalidTarget.state, [invalidTarget.event], Engine).queued.length, 1);
  const costUid = invalidTarget.own.soul[0].uid;
  const rejected = response(invalidTarget, "cfa-10118:1", {
    targetUid: invalidTarget.opponent.vanguard.uid,
    costSelections: { cb: [], sb: [costUid], discard: [], reveal: [] }
  });
  assert.equal(rejected.ok, false, "opponent Vanguard is not a legal target");
  assert.equal(invalidTarget.own.soul.some(card => card.uid === costUid), true, "rejected target does not pay the cost");
  assert.equal(invalidTarget.opponent.vanguard.turnPowerBoost || 0, 0);
});

test("cfa-10118:0 stays unavailable until the reducer has a reviewed server gate for its discard cost sequence", () => {
  const ability = abilities.get("cfa-10118:0").ability;
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
  assert.equal(ability.definition, null);
  assert.match(contribution.audit.unsupportedSiblings.find(item => item.abilityId === "cfa-10118:0").blocker, /authoritative reducer.*only trusts its ride-phase and Grade-2-gated exact templates/i);
  for (const side of ["human", "bot"]) {
    const f = discardedSourceFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${side}: unsupported discard skill does not prompt`);
  }
});

test("cfa-10129:0 triggers from a friendly unit boosting a Vanguard and resolves for either seat", () => {
  const ability = abilities.get("cfa-10129:0").ability;
  assert.equal(ability.trigger.eventType, "unit.boosted");
  assert.equal(ability.trigger.subject, "any");
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.equal(ability.trigger.subjectControllerRelation, "source-controller");
  assert.equal(ability.printedText, "AUTO [RC]: When your unit boosts a vanguard, this unit gets power +2000 until end of turn.");
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "turn" }]);
  for (const side of ["human", "bot"]) {
    const f = boostFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${side}: exact source boost triggers`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${side}: replay does not duplicate`);
    const proxyUid = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(response(f, "cfa-10129:0", {}, proxyUid).ok, false, `${side}: opponent cannot resolve the trigger`);
    const resolved = response(f, "cfa-10129:0");
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolves"}`);
    assert.equal(f.source.turnPowerBoost, 2000);
    assert.equal(f.state.pendingAttack.power, 15000, `${side}: battle includes the booster's turn modifier`);
  }
  const wrongTarget = boostFixture("human");
  const rearGuardBoost = eventFor(wrongTarget.state, { ...wrongTarget.event, eventId: undefined, targetLocation: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [rearGuardBoost], Engine).queued.length, 0, "boosting a Rear-Guard does not trigger");
  const ownOtherBooster = boostFixture("human");
  const anotherBooster = instance("cfa-1", "other-own-booster", ownOtherBooster.ownId, { circle: "rear-right", rested: true });
  ownOtherBooster.own.rear[1] = anotherBooster;
  ownOtherBooster.state.pendingAttack.boostUid = anotherBooster.uid;
  const eventFromOtherBooster = eventFor(ownOtherBooster.state, {
    ...ownOtherBooster.event, eventId: undefined, sourceCardInstanceId: anotherBooster.uid,
    sourceOwnerPlayerId: anotherBooster.ownerPlayerId, sourceControllerPlayerId: anotherBooster.controllerPlayerId,
    cardInstanceId: anotherBooster.uid, subjectCardInstanceId: anotherBooster.uid,
    subjectOwnerPlayerId: anotherBooster.ownerPlayerId, subjectControllerPlayerId: anotherBooster.controllerPlayerId,
    boosterCardInstanceId: anotherBooster.uid
  });
  assert.equal(Reducer.discoverAutoTriggers(ownOtherBooster.state, [eventFromOtherBooster], Engine).queued.length, 1, "another controlled unit may boost the Vanguard and trigger this source");
  assert.equal(ownOtherBooster.state.pendingAbility.instance.uid, ownOtherBooster.source.uid, "the AUTO source remains the exact cfa-10129 instance");
  const opponentBooster = boostFixture("human");
  const hostileEvent = eventFor(opponentBooster.state, {
    ...opponentBooster.event, eventId: undefined, actingPlayerId: opponentBooster.opponentId,
    turnPlayerId: opponentBooster.opponentId, sourceControllerPlayerId: opponentBooster.opponentId,
    subjectControllerPlayerId: opponentBooster.opponentId, targetLocation: "vanguard"
  });
  assert.equal(Reducer.discoverAutoTriggers(opponentBooster.state, [hostileEvent], Engine).queued.length, 0, "an opponent's booster cannot trigger the controller's AUTO");
  const leftCircle = boostFixture("human");
  leftCircle.own.rear[0] = null;
  leftCircle.own.drop.push(leftCircle.source);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", leftCircle.event, leftCircle.source.uid, "drop", "vanguard", leftCircle.ownId), false,
    "Drop is not a legal source location for this [RC] AUTO");
});

test("cfa-10133:1 calls only the exact ridden source when a Blaster Vanguard rides it", () => {
  const ability = abilities.get("cfa-10133:1").ability;
  assert.equal(ability.trigger.eventType, "card.ridden");
  assert.equal(ability.trigger.subject, "ridden-unit");
  assert.equal(ability.trigger.riderCardNameContains, "Blaster");
  assert.deepEqual(ability.trigger.circles, ["vanguard"]);
  assert.deepEqual(ability.effects, [{ op: "call-source-from-soul", target: "source", position: "stand" }]);
  for (const side of ["human", "bot"]) {
    const f = riddenCallFixture(side);
    assert.match(f.rider.cardName, /Blaster/i);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${side}: qualifying ride prompts`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side}: the prior Vanguard is the AUTO source`);
    const wrongSeat = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(response(f, "cfa-10133:1", { callZone: "rear-left" }, wrongSeat).ok, false, `${side}: opponent cannot resolve the AUTO`);
    const result = response(f, "cfa-10133:1", { callZone: "rear-left" });
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolves"}`);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), false, `${side}: exact source leaves Soul`);
    assert.equal(f.own.rear[0].uid, f.source.uid, `${side}: exact source is called to RC`);
    assert.equal(f.own.rear[0].rested, false, `${side}: call is standing`);
  }
  const unrelatedRider = riddenCallFixture("human", "cfa-3");
  assert.equal(Reducer.discoverAutoTriggers(unrelatedRider.state, [unrelatedRider.event], Engine).queued.length, 0, "a non-Blaster rider fails the name restriction");
  const otherPreviousVanguard = riddenCallFixture("human", "cfa-664", false);
  assert.equal(Reducer.discoverAutoTriggers(otherPreviousVanguard.state, [otherPreviousVanguard.event], Engine).queued.length, 0, "another card being ridden cannot trigger this source");
});

test("cfa-1012:0 remains the existing production Limit Break attack definition", () => {
  const ability = abilities.get("cfa-1012:0").ability;
  assert.ok(ability.definition);
  assert.equal(ability.definition.source.patternId, "auto-legacy-limit-break-vanguard-attack-power-v1");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.equal(ability.trigger.eventType, "unit.attacked");
  assert.equal(ability.trigger.subject, "source");
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});
