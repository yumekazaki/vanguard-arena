"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0012.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const audit = contribution.audit;
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const registryRows = fs.readFileSync(path.join(__dirname, "ability-work-registry.jsonl"), "utf8")
  .trim().split(/\r?\n/).map(JSON.parse);
const batchRows = registryRows.filter(row => row.batchId === audit.batchId);
const rowById = new Map(batchRows.map(row => [row.abilityId, row]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function getAbility(abilityId) {
  const row = rowById.get(abilityId);
  assert.ok(row, `${abilityId}: claimed batch row exists`);
  const card = catalogById.get(String(row.cardId));
  assert.ok(card, `${abilityId}: card exists in catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `${abilityId}: parser returns this exact skill`);
  return { row, card, ability };
}

function player(playerId, vanguard = null) {
  return { playerId, vanguard, rear: Array(5).fill(null), soul: [], hand: [], deck: [], drop: [], bind: [],
    damage: [], orders: [], rideDeck: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [], crests: [] };
}

function stateFor(side, own, opponent, matchId) {
  return { matchId, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    turn: 3, side, phase: 5,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
}

function event(state, values) {
  return Engine.createGameEvent(state, values);
}

function attackFixture(side) {
  const { card, ability } = getAbility("cfa-1119:2");
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${side}`, cardId: card.id, cardName: card.name, type: "Unit", unitCard: true,
    grade: Number(card.grade), power: Number(card.power), ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const target = { uid: `target-${side}`, cardId: "test-opponent-vg", cardName: "Opponent Vanguard", type: "Unit", unitCard: true,
    grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  const own = player(ownerId, source);
  const opponent = player(opponentId, target);
  const state = stateFor(side, own, opponent, `batch-0012-attack-${side}`);
  const battleId = `battle-${side}`;
  state.pendingAttack = { battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId,
    attackerZone: "vanguard", defenderSide: side === "human" ? "bot" : "human", targetUid: target.uid,
    targetZone: "vanguard", power: source.power, critical: 1 };
  const attackEvent = event(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId,
    subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [source.uid], currentLocation: "vanguard",
    previousLocation: "vanguard", circle: "vanguard", targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, own, opponent, source, target, ability, side, ownerId, attackEvent };
}

function forerunnerFixture(side, { riderClan, unrelatedTarget = false } = {}) {
  const { card, ability } = getAbility("cfa-1120:0");
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const clan = card.clan || card.clans?.[0] || "Royal Paladin";
  const source = { uid: `forerunner-source-${side}`, cardId: card.id, cardName: card.name, type: "Unit", grade: 0,
    clan, clans: [clan], ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const rider = { uid: `forerunner-rider-${side}`, cardId: "test-rider", cardName: "Rider", type: "Unit", grade: 1,
    clan: riderClan || clan, clans: [riderClan || clan], ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const own = player(ownerId, rider);
  own.soul.push(source);
  const opponent = player(opponentId);
  const state = stateFor(side, own, opponent, `batch-0012-forerunner-${side}`);
  const rideEvent = event(state, { type: "card.ridden", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    sourceCardClan: rider.clan, sourceCardClans: rider.clans, cardInstanceId: rider.uid,
    subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [unrelatedTarget ? "other-source" : source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride" });
  return { state, own, opponent, source, rider, ability, side, ownerId, rideEvent };
}

function decideAuto(f, abilityId, accept, selection = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `decision-${f.state.matchId}-${abilityId}-${accept}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept,
      selection: { instanceUid: f.source.uid, abilityId, ...selection } }
  }, seats, Engine);
}

function actFixture(side) {
  const { card, ability } = getAbility("cfa-1120:1");
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const clan = card.clan || card.clans?.[0] || "Royal Paladin";
  const source = { uid: `act-source-${side}`, cardId: card.id, cardName: card.name, type: "Unit", grade: 0,
    clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, zone: "rear-guard", circle: "rear-left" };
  const target = { uid: `act-target-${side}`, cardId: "test-friendly-unit", cardName: "Friendly Unit", type: "Unit",
    unitCard: true, grade: 2, clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, turnPowerBoost: 0 };
  const own = player(ownerId, { uid: `act-vg-${side}`, cardId: "test-vg", type: "Unit", grade: 3,
    ownerPlayerId: ownerId, controllerPlayerId: ownerId });
  own.rear[0] = source;
  own.rear[1] = target;
  const opponent = player(opponentId, { uid: `act-opp-vg-${side}`, type: "Unit", grade: 3,
    ownerPlayerId: opponentId, controllerPlayerId: opponentId });
  const state = stateFor(side, own, opponent, `batch-0012-act-${side}`);
  state.phase = 4;
  return { state, own, opponent, source, target, ability, side, ownerId,
    actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}

function activateAct(f, selection, actionId) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: f.actorAuthUid,
    actionId: actionId || `act-${f.side}-${JSON.stringify(selection)}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid,
      abilityId: f.ability.id, selection }
  }, seats, Engine);
}

test("batch accounts for all 52 exact claimed IDs and preserves catalog/registry text", () => {
  assert.deepEqual(contribution, [], "no audit metadata is enumerable as executable code");
  assert.equal(Object.prototype.propertyIsEnumerable.call(contribution, "audit"), false);
  assert.equal(audit.batchId, "ABILITY-76D8A0B8-0012");
  assert.equal(audit.claimBranch, "claims/ABILITY-76D8A0B8-0012");
  assert.equal(batchRows.length, 52);
  assert.deepEqual(batchRows.map(row => row.abilityId).sort(), [...audit.assignedAbilityIds].sort());
  assert.equal(new Set(audit.assignedAbilityIds).size, 52);
  assert.equal(Object.keys(audit.existingDefinitions).length, 9);
  assert.equal(Object.keys(audit.unsupported).length, 43);
  assert.deepEqual([...Object.keys(audit.existingDefinitions), ...Object.keys(audit.unsupported)].sort(),
    [...audit.assignedAbilityIds].sort());
  assert.deepEqual(audit.productionVerifiedIds, []);
  assert.deepEqual(audit.testOnlyProposals, []);
  for (const id of audit.assignedAbilityIds) {
    const { row, card, ability } = getAbility(id);
    assert.equal(ability.printedText, row.printedText, `${id}: registry text unchanged`);
    assert.ok(card.text.includes(ability.printedText), `${id}: original catalog text retained`);
    assert.equal(audit.wholeCardStatus[row.cardId]?.status, "unverified", `${row.cardId}: not whole-card certified`);
  }
  const cardIds = [...new Set(audit.assignedAbilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))];
  assert.equal(cardIds.length, 25);
  assert.deepEqual(Object.keys(audit.wholeCardStatus).sort(), cardIds.sort());
  assert.ok(audit.assignedAbilityIds.every(id => rowById.get(id).implementationStatus === "unreviewed"
    || audit.existingDefinitions[id]), "this batch does not alter shared registry verification state");
});

test("Bushiroad provenance is explicit per card; identity-only and mismatched text are not counted as exact", () => {
  const evidence = audit.officialTextEvidence;
  const assignedCardIds = [...new Set(audit.assignedAbilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))].sort();
  assert.deepEqual(Object.keys(evidence).sort(), assignedCardIds);
  for (const [cardId, source] of Object.entries(evidence)) {
    assert.ok(source.note.length > 25, `${cardId}: source limits explained`);
    if (source.url) assert.equal(new URL(source.url).hostname, "en.cf-vanguard.com", `${cardId}: official Bushiroad domain`);
    for (const abilityId of source.exactAbilityIds) {
      assert.ok(audit.assignedAbilityIds.includes(abilityId), `${cardId}: exact source is for an assigned ID`);
      assert.ok(source.status === "exact" || source.status === "partial-catalog-text-mismatch",
        `${cardId}: only exact-text source classes can claim exact IDs`);
    }
  }
  assert.equal(evidence["cfa-11187"].status, "identity-only-name-mismatch");
  assert.equal(evidence["cfa-11192"].status, "identity-conflict");
  assert.equal(evidence["cfa-11194"].exactAbilityIds.includes("cfa-11194:0"), false,
    "the local typo is not silently normalized to official card text");
  assert.equal(evidence["cfa-1121"].exactAbilityIds.includes("cfa-1121:1"), false,
    "local top-card wording difference is not silently certified");
  assert.equal(evidence["cfa-11204"].status, "partial");
});

test("pre-existing definitions are distinguished from verified server production support", () => {
  for (const [id, record] of Object.entries(audit.existingDefinitions)) {
    const { ability } = getAbility(id);
    assert.equal(ability.definition?.source?.patternId, record.patternId, `${id}: existing shared pattern`);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(item => item.id === id), `${id}: reviewed binding exists`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), record.serverSupported, `${id}: resolver capability is checked`);
    assert.ok(record.blocker.length > 60, `${id}: unresolved provenance/runtime limitation is concrete`);
    assert.notEqual(rowById.get(id).implementationStatus, "verified", `${id}: no whole-ability verified label is written`);
  }
  assert.deepEqual(Object.entries(audit.existingDefinitions).filter(([, value]) => value.serverSupported).map(([id]) => id).sort(),
    ["cfa-1119:2", "cfa-1120:0", "cfa-1120:1"].sort());
});

test("the existing own-Vanguard-attack definition resolves for its controller on host and joining seats only", () => {
  const seatsBySide = ["human", "bot"];
  for (const side of seatsBySide) {
    const f = attackFixture(side);
    const result = Reducer.discoverAutoTriggers(f.state, [f.attackEvent], Engine);
    assert.ok(result.queued.some(item => item.ability?.id === f.ability.id || item.abilityId === f.ability.id));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const decision = decideAuto(f, f.ability.id, true);
    assert.equal(decision.ok, true, decision.reason);
    assert.equal(f.state.pendingAttack.power, Number(f.source.power) + 3000);
    assert.equal(f.state.pendingAbility, null);

    const wrong = attackFixture(side);
    const unrelatedAttack = event(wrong.state, { ...wrong.attackEvent, eventId: undefined, sequence: undefined,
      sourceCardInstanceId: "other-attacker", cardInstanceId: "other-attacker", subjectCardInstanceId: "other-attacker",
      attackingCardInstanceIds: ["other-attacker"] });
    const wrongResult = Reducer.discoverAutoTriggers(wrong.state, [unrelatedAttack], Engine);
    assert.equal(wrongResult.queued.some(item => item.ability?.id === wrong.ability.id || item.abilityId === wrong.ability.id), false,
      `${side}: another card's attack cannot trigger this ability`);
  }
});

test("the existing Forerunner definition matches the ridden source and resolves privately on both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = forerunnerFixture(side);
    const queued = Reducer.discoverAutoTriggers(f.state, [f.rideEvent], Engine);
    assert.equal(queued.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const accepted = decideAuto(f, f.ability.id, true, { callZone: "rear-left" });
    assert.equal(accepted.ok, true, accepted.reason);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), false);
    assert.equal(f.own.rear[0]?.uid, f.source.uid);
    assert.equal(f.opponent.rear.every(card => !card), true);

    const declined = forerunnerFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.rideEvent], Engine).queued.length, 1);
    const decline = decideAuto(declined, declined.ability.id, false);
    assert.equal(decline.ok, true, decline.reason);
    assert.equal(declined.own.soul[0]?.uid, declined.source.uid);
    assert.equal(declined.own.rear.every(card => !card), true);

    const wrongClan = forerunnerFixture(side, { riderClan: "Kagero" });
    assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.rideEvent], Engine).queued.length, 0,
      `${side}: a different-clan ride must not satisfy Forerunner`);
    const wrongTarget = forerunnerFixture(side, { unrelatedTarget: true });
    assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.rideEvent], Engine).queued.length, 0,
      `${side}: riding another card cannot trigger this source`);
  }
});

test("the existing Claudia ACT pays its source-to-Soul cost and handles optional targets for either seat", () => {
  for (const side of ["human", "bot"]) {
    const targeted = actFixture(side);
    assert.equal(Reducer.supportsServerAbilityEffects(targeted.ability), true);
    assert.deepEqual(targeted.ability.costs, [{ type: "source-to-soul", count: 1 }]);
    const applied = activateAct(targeted, { targetUid: targeted.target.uid }, `claudia-target-${side}`);
    assert.equal(applied.ok, true, applied.reason);
    assert.equal(targeted.own.rear[0], null);
    assert.equal(targeted.own.soul.at(-1).uid, targeted.source.uid);
    assert.equal(targeted.target.turnPowerBoost, 3000);
    assert.equal(targeted.opponent.rear.every(card => !card), true);

    const noTarget = actFixture(side);
    const skipped = activateAct(noTarget, { optionalNoTarget: true }, `claudia-no-target-${side}`);
    assert.equal(skipped.ok, true, skipped.reason);
    assert.equal(noTarget.own.soul.at(-1).uid, noTarget.source.uid);
    assert.equal(noTarget.target.turnPowerBoost, 0);

    const invalid = actFixture(side);
    const enemy = { uid: `enemy-target-${side}`, cardId: "test-enemy", type: "Unit", clan: "Kagero",
      ownerPlayerId: invalid.opponent.playerId, controllerPlayerId: invalid.opponent.playerId };
    invalid.opponent.rear[0] = enemy;
    const before = JSON.stringify(invalid.state);
    const rejected = activateAct(invalid, { targetUid: enemy.uid }, `claudia-invalid-${side}`);
    assert.equal(rejected.ok, false);
    assert.equal(JSON.stringify(invalid.state), before, `${side}: invalid target does not pay the source cost`);
  }
});

test("all 43 unimplemented skills remain unavailable to AUTO processing and manual activation on both seats", () => {
  const candidateEventTypes = ["card.placed", "card.ridden", "unit.attacked", "unit.boosted", "attack.hit",
    "card.retired", "card.moved", "battle.close-step", "turn.phase-changed", "ride.phase.started", "order.played", "unit.stood"];
  for (const id of Object.keys(audit.unsupported)) {
    const { card, ability } = getAbility(id);
    assert.equal(ability.definition, null, `${id}: no compiled runtime definition`);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === id), false,
      `${id}: no reviewed production binding`);
    assert.ok(audit.unsupported[id].length > 70, `${id}: concrete fail-closed blocker`);

    for (const side of ["human", "bot"]) {
      const ownerId = side === "human" ? "player-host" : "player-guest";
      const opponentId = side === "human" ? "player-guest" : "player-host";
      const source = { uid: `unsupported-${id}-${side}`, cardId: card.id, cardName: card.name,
        type: card.type, unitCard: /unit|trigger/i.test(String(card.type)), grade: Number(card.grade),
        ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: card.clan, zone: "rear-guard", circle: "rear-left" };
      const ownVanguard = { uid: `unsupported-vg-${id}-${side}`, cardId: "test-vg", cardName: "Test Vanguard",
        type: "Unit", unitCard: true, grade: 3, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
      const own = player(ownerId, ownVanguard);
      const opponent = player(opponentId, { uid: `opponent-vg-${id}-${side}`, type: "Unit", unitCard: true,
        grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId });
      const locationText = String(ability.printedText).toLowerCase();
      if (locationText.includes("[vc]") || locationText.includes("vanguard circle")) {
        own.vanguard = source;
        source.zone = "vanguard";
        source.circle = "vanguard";
      } else if (locationText.includes("[order zone]")) {
        own.orders.push(source);
        source.zone = "order-zone";
      } else if (locationText.includes("[ride deck]")) {
        own.rideDeck.push(source);
        source.zone = "ride-deck";
      } else if (locationText.includes("[gc]")) {
        own.guardCircle.push(source);
        source.zone = "guardian";
      } else {
        own.rear[0] = source;
      }
      const state = stateFor(side, own, opponent, `unsupported-${id}-${side}`);
      const ownerAuthUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;

      if (ability.kind === "AUTO") {
        for (const type of candidateEventTypes) {
          const candidate = event(state, { type, actingPlayerId: ownerId, turnPlayerId: ownerId,
            sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
            cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId,
            subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: source.zone,
            circle: source.circle, targetCardInstanceIds: [source.uid], targetLocation: source.zone,
            phase: "batch-audit", timingWindow: "batch-audit" });
          const result = Reducer.discoverAutoTriggers(state, [candidate], Engine);
          assert.equal(result.queued.some(item => item.ability?.id === id || item.abilityId === id), false,
            `${id}/${side}: ${type} cannot activate an uncompiled skill`);
          assert.notEqual(state.pendingAbility?.ability?.id, id, `${id}/${side}: no self prompt`);
        }
      } else if (ability.kind === "ACT") {
        const before = JSON.stringify(state);
        const rejected = Reducer.applyManualAbilityActivation(state, {
          actorAuthUid: ownerAuthUid, actionId: `uncompiled-act-${id}-${side}`,
          expectedStateVersion: state.stateVersion,
          payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: id, selection: {} }
        }, seats, Engine);
        assert.equal(rejected.ok, false, `${id}/${side}: unsupported ACT rejected`);
        assert.equal(JSON.stringify(state), before, `${id}/${side}: rejected activation changes nothing`);
      }
    }
  }
});

test("batch never infers whole-card completion from ability coverage", () => {
  for (const [cardId, record] of Object.entries(audit.wholeCardStatus)) {
    assert.equal(record.status, "unverified", cardId);
    const card = catalogById.get(cardId);
    assert.ok(card);
    assert.equal(Engine.parseCardAbilitiesCached(card).length,
      batchRows.filter(row => row.cardId === cardId).length, `${cardId}: all parsed ability IDs are accounted for`);
  }
});
