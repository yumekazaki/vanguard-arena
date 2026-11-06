"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0019.js");
Engine.registerAbilityDefinitions(batch);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const EXPECTED_IDS = [
  "cfa-11380:0", "cfa-11380:1", "cfa-11382:0", "cfa-11382:1", "cfa-11383:0",
  "cfa-11383:1", "cfa-11384:0", "cfa-11384:1", "cfa-11385:0", "cfa-11385:1",
  "cfa-11386:0", "cfa-11387:0", "cfa-11387:1", "cfa-11388:0", "cfa-11389:0",
  "cfa-11389:1", "cfa-1138:0", "cfa-1138:1", "cfa-11390:0", "cfa-11390:1",
  "cfa-11391:0", "cfa-11391:1", "cfa-11392:0", "cfa-11392:1", "cfa-11393:0",
  "cfa-11393:1", "cfa-11393:2", "cfa-11394:0", "cfa-11394:1", "cfa-11395:0",
  "cfa-11395:1", "cfa-11397:0", "cfa-11397:1", "cfa-11398:0", "cfa-11398:1",
  "cfa-11399:0", "cfa-1139:0", "cfa-11400:0", "cfa-11400:1", "cfa-11402:0",
  "cfa-11403:0", "cfa-11404:0", "cfa-114:0"
];
const SUPPORTED = ["cfa-11380:0", "cfa-11380:1", "cfa-1138:0", "cfa-11397:0", "cfa-11400:1"];
const PROPOSED = ["cfa-1139:0"];

function abilityFor(id) {
  const colon = id.lastIndexOf(":");
  const card = cards.get(id.slice(0, colon));
  assert.ok(card, `catalog contains ${id}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `catalog parser preserves ${id}`);
  return { card, ability };
}

function instance(cardOrId, uid, playerId, extra = {}) {
  const definition = typeof cardOrId === "string" ? cards.get(cardOrId) : cardOrId;
  assert.ok(definition, `catalog card ${cardOrId?.id || cardOrId} exists`);
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    type: definition.type || "Unit",
    grade: Number(definition.grade || 0),
    clan: definition.clan,
    clans: [...(definition.clans || (definition.clan ? [definition.clan] : []))],
    power: Number(definition.power || 0),
    shield: Number(definition.shield || 0),
    trigger: definition.trigger || "",
    unitCard: true,
    critical: 1,
    rested: false,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: [], crests: [] };
}

function authFor(side) { return side === "human" ? seats.hostAuthUid : seats.guestAuthUid; }

function gcFixture(ownerSide) {
  const card = cards.get("cfa-11380"), ownerId = ownerSide === "human" ? "host-player" : "guest-player";
  const attackerSide = ownerSide === "human" ? "bot" : "human", attackerId = ownerSide === "human" ? "guest-player" : "host-player";
  const source = instance(card, `bug-${ownerSide}-source`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance("cfa-2", `bug-${ownerSide}-payment`, ownerId, { zone: "hand" });
  const target = instance("cfa-3", `bug-${ownerSide}-target`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const own = player(ownerId), opponent = player(attackerId);
  own.vanguard = target; own.hand = [payment]; own.guardCircle = [source];
  opponent.vanguard = instance("cfa-3", `bug-${ownerSide}-attacker`, attackerId, { zone: "vanguard", circle: "vanguard" });
  const battleId = `bug-${ownerSide}-battle`;
  const state = { matchId: `batch19-gc-${ownerSide}`, stateVersion: 1, eventSequence: 0, turn: 4, phase: "guard",
    side: attackerSide, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: ownerSide === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId, attackerSide, attackerPlayerId: attackerId, attackerUid: opponent.vanguard.uid, attackerZone: "vanguard",
      defenderSide: ownerSide, defenderPlayerId: ownerId, targetUid: target.uid, targetZone: "vanguard", power: 18000,
      targetPower: 10000, critical: 1, guardCards: [] } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard-placement", battleId });
  return { state, source, payment, target, ownerSide, event, ability: abilityFor("cfa-11380:1").ability };
}

function driveFixture(cardId, abilityIndex, side, sourceCircle, checkedId = "cfa-2") {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = instance(cardId, `drive-${cardId}-${side}-source`, ownerId,
    { zone: sourceCircle, circle: sourceCircle === "vanguard" ? "vanguard" : "rear-left" });
  const attacker = sourceCircle === "vanguard" ? source : instance("cfa-1138", `drive-${cardId}-${side}-attacker`, ownerId,
    { zone: "vanguard", circle: "vanguard" });
  const target = instance("cfa-3", `drive-${cardId}-${side}-target`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const checked = instance(checkedId, `drive-${cardId}-${side}-checked`, ownerId, { zone: "trigger", triggerZone: true });
  const own = player(ownerId), other = player(opponentId);
  own.vanguard = attacker;
  if (sourceCircle === "vanguard") own.vanguard = source;
  else own.rear[0] = source;
  own.triggerZone = [checked]; other.vanguard = target;
  const battleId = `drive-${cardId}-${side}-battle`;
  const state = { matchId: `batch19-drive-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingCheckCard: { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId },
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own },
    pendingAttack: { battleId, attackerSide: side, attackerPlayerId: ownerId, attackerUid: attacker.uid, attackerZone: "vanguard",
      defenderSide: opponentSide, targetUid: target.uid, targetZone: "vanguard", awaitingDrive: true } };
  const ability = Engine.parseCardAbilitiesCached(cards.get(cardId)).find(item => item.id === `${cardId}:${abilityIndex}`);
  assert.ok(ability, `${cardId}:${abilityIndex} parses`);
  const event = Engine.createGameEvent(state, { type: "drive.checked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attacker.uid, sourceControllerPlayerId: ownerId, cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid,
    checkedCardInstanceId: checked.uid, checkedCardControllerPlayerId: ownerId, checkedCardTriggerType: checked.trigger || "",
    previousLocation: "deck", currentLocation: "trigger", checkKind: "drive", battleId, phase: "battle", timingWindow: "drive-check" });
  return { state, own, other, source, checked, ability, event, side, ownerId, attacker };
}

function resolveDrive(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authFor(f.side), actionId: `batch19-drive-resolve-${f.source.uid}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

function hitFixture(side, sourceCircle = "vanguard", { wrongClan = false, faceUpDamage = 1 } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = instance("cfa-1139", `sahohime-${side}-${sourceCircle}-source`, ownerId,
    { zone: sourceCircle, circle: sourceCircle === "vanguard" ? "vanguard" : "rear-left" });
  const ownVanguard = sourceCircle === "vanguard" ? source : instance(wrongClan ? "cfa-491" : "cfa-1138", `sahohime-${side}-vg`, ownerId,
    { zone: "vanguard", circle: "vanguard" });
  const target = instance("cfa-3", `sahohime-${side}-target`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const own = player(ownerId), other = player(opponentId);
  own.vanguard = ownVanguard;
  if (sourceCircle !== "vanguard") own.rear[0] = source;
  own.damage = Array.from({ length: faceUpDamage }, (_, i) => instance("cfa-3", `sahohime-${side}-damage-${i}`, ownerId,
    { zone: "damage", faceDown: false }));
  own.deck = ["cfa-2", "cfa-3", "cfa-4"].map((id, i) => instance(id, `sahohime-${side}-deck-${i}`, ownerId, { zone: "deck" }));
  other.vanguard = target;
  const battleId = `sahohime-${side}-${sourceCircle}-battle`;
  const state = { matchId: `batch19-sahohime-${side}-${sourceCircle}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own },
    pendingAttack: { battleId, attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid,
      attackerZone: sourceCircle === "vanguard" ? "vanguard" : "rear-left", defenderSide: opponentSide, targetUid: target.uid,
      targetZone: "vanguard", power: 16000, targetPower: 10000, critical: 1, closing: true } };
  const ability = Engine.parseCardAbilitiesCached(cards.get("cfa-1139")).find(item => item.id === "cfa-1139:0");
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: opponentId, subjectControllerPlayerId: opponentId,
    targetCardInstanceIds: [target.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid,
    currentLocation: sourceCircle === "vanguard" ? "vanguard" : "rear-left", previousLocation: sourceCircle === "vanguard" ? "vanguard" : "rear-left",
    battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, own, other, source, target, ability, event, side, ownerId, opponentId, battleId };
}

function resolveHit(f, accept, actorAuthUid = authFor(f.side)) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `batch19-sahohime-resolve-${f.battleId}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
        costSelections: { cb: f.own.damage.filter(card => !card.faceDown).slice(0, 1).map(card => card.uid), sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test("the batch accounts for all 43 exact IDs as existing, proposed, or blocked", () => {
  assert.equal(batch.audit.batchId, "ABILITY-76D8A0B8-0019");
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.equal(new Set(EXPECTED_IDS).size, 43);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, SUPPORTED);
  assert.deepEqual(batch.audit.proposedDefinitionIds, PROPOSED);
  assert.equal(batch.audit.blocked.length, 37);
  const accounted = [...SUPPORTED, ...PROPOSED, ...batch.audit.blocked.map(row => row.abilityId)];
  assert.equal(new Set(accounted).size, 43);
  assert.deepEqual([...accounted].sort(), [...EXPECTED_IDS].sort());
  for (const id of EXPECTED_IDS) {
    const { card, ability } = abilityFor(id);
    assert.ok(card.text.includes(ability.printedText), `${id} retains exact catalog text`);
  }
});

test("all 37 unsupported abilities remain fail-closed with a concrete blocker", () => {
  for (const { abilityId, blocker } of batch.audit.blocked) {
    const { ability } = abilityFor(abilityId);
    assert.equal(ability.definition, null, `${abilityId} has no guessed definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId} has no server resolution path`);
    if (ability.kind === "ACT") {
      assert.equal(Engine.canActivateManualAbility(ability, { cardInstanceId: "source", controllerPlayerId: "p1",
        actorPlayerId: "p1", turnPlayerId: "p1", phase: "main", inPermittedZone: true, conditions: {}, resources: {} }).reason,
      "unsupported-effect", `${abilityId} cannot be manually activated without a definition`);
    }
    assert.ok(blocker.length > 55, `${abilityId} explains missing behavior`);
  }
});

test("existing code patterns are accurately classified and passive Sentinel is not an ACT", () => {
  const patterns = new Map([
    ["cfa-11380:0", "cont-sentinel-keyword-v1"],
    ["cfa-11380:1", "auto-gc-when-placed-discard-protect-unit-v1"],
    ["cfa-1138:0", "cont-named-soul-card-power-v1"],
    ["cfa-11397:0", "auto-drive-check-normal-unit-source-power-turn-v1"],
    ["cfa-11400:1", "auto-drive-check-normal-unit-source-power-turn-v1"]
  ]);
  for (const [id, pattern] of patterns) {
    const { ability } = abilityFor(id);
    assert.equal(ability.definition?.source?.patternId, pattern, id);
  }
  const sentinel = abilityFor("cfa-11380:0");
  assert.equal(sentinel.ability.kind, "CONT");
  assert.equal(Engine.hasAbilityKeyword([sentinel.ability], "sentinel"), true);
  assert.equal(Engine.isManuallyActivatable(sentinel.ability), false);
  assert.equal(Reducer.supportsServerAbilityEffects(abilityFor("cfa-11380:1").ability), true);
  assert.equal(Reducer.supportsServerAbilityEffects(abilityFor("cfa-11397:0").ability), true);
  assert.equal(Reducer.supportsServerAbilityEffects(abilityFor("cfa-11400:1").ability), true);
  const official = new Map(batch.audit.officialReferences.map(row => [row.abilityId, row]));
  for (const id of ["cfa-1138:0", "cfa-1139:0", "cfa-114:0"]) {
    assert.match(official.get(id)?.url || "", /^https:\/\/en\.cf-vanguard\.com\/cardlist\//, `${id} has official citation`);
  }
  assert.deepEqual(batch.audit.provenanceWarnings.map(row => row.abilityIds), [
    ["cfa-11380:0", "cfa-11380:1"], ["cfa-11397:0", "cfa-11400:1"]
  ]);
});

test("the existing Artemis Soul CONT checks only controller Soul and Vanguard circle", () => {
  const { ability } = abilityFor("cfa-1138:0");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.equal(ability.definition.effects[0].condition.name, "Bowstring of Heaven and Earth, Artemis");
  assert.equal(ability.definition.effects[0].amount, 1000);
  for (const side of ["human", "bot"]) {
    assert.equal(Engine.evaluateContinuousEffects([ability], {
      location: "vanguard", soulCardNames: ["Bowstring of Heaven and Earth, Artemis"]
    }).power, 1000, `${side}: own Soul name satisfies condition`);
    assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", soulCardNames: ["Bowstring of Heaven and Earth, Artemis"] }).power, 0);
    assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", soulCardNames: ["Other Artemis"] }).power, 0);
  }
});

test("existing normal-unit drive-check AUTO resolves for the host or joining player only", () => {
  const cases = [["cfa-11397", 0], ["cfa-11400", 1]];
  for (const [cardId, index] of cases) for (const side of ["human", "bot"]) {
    const sourceCircle = cardId === "cfa-11400" ? "rear-left" : side === "human" ? "vanguard" : "rear-left";
    const f = driveFixture(cardId, index, side, sourceCircle);
    assert.deepEqual(f.ability.trigger, { status: "recognized-trigger", eventType: "drive.checked", subject: "controller",
      circles: [], checkKind: "drive", checkedCardTriggerType: "" });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    const wrongAuth = authFor(side === "human" ? "bot" : "human");
    assert.equal(Reducer.applyAbilityDecision(f.state, { actorAuthUid: wrongAuth, actionId: `wrong-${cardId}-${side}`,
      expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine).ok, false, `${cardId}/${side}: opponent cannot resolve`);
    assert.equal(resolveDrive(f).ok, true, `${cardId}/${side}`);
    assert.equal(f.source.turnPowerBoost, 3000);
    assert.equal(f.source.turnPowerExpiry, f.own.playerId);
    assert.equal(f.other.soul.length, 0);
  }
  const triggerCheck = driveFixture("cfa-11397", 0, "human", "rear-left", "cfa-3");
  assert.equal(Reducer.discoverAutoTriggers(triggerCheck.state, [triggerCheck.event], Engine).queued.length, 0, "a Trigger Unit does not match the normal-unit condition");
  const wrongSource = driveFixture("cfa-11397", 0, "human", "rear-left");
  const forged = Engine.createGameEvent(wrongSource.state, { ...wrongSource.event, eventId: undefined, sourceCardInstanceId: "unrelated-vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [forged], Engine).queued.length, 0, "unrelated battle source does not qualify");
  const wrongCircle = driveFixture("cfa-11400", 1, "human", "vanguard");
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0, "RC-only ability is not active from VC");
});

test("proposed Sahohime AUTO matches Bushiroad text, paid cost, trigger, and both player seats", () => {
  const { ability } = abilityFor("cfa-1139:0");
  const definition = batch.find(item => item.id === ability.id);
  const ref = batch.audit.officialReferences.find(row => row.abilityId === ability.id);
  assert.equal(definition.printedText, ability.printedText);
  assert.equal(definition.source.officialCardNumber, "BT10/029EN");
  assert.equal(definition.source.officialReference, ref.url);
  assert.deepEqual(definition.trigger, { status: "recognized-trigger", eventType: "attack.hit", subject: "source",
    circles: [], targetLocation: "vanguard" });
  assert.deepEqual(definition.requiredLocation, ["vanguard", "rear-guard"]);
  assert.deepEqual(definition.conditions, [{ type: "controller-vanguard-has-clan", value: "Genesis" }]);
  assert.deepEqual(definition.costs, [{ type: "counter-blast", count: 1 }]);
  assert.deepEqual(definition.effects, [{ op: "soul-charge", count: 3 }]);
  assert.equal(definition.optional, true);
  assert.equal(ability.canDecline, true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-left"]) {
    const f = hitFixture(side, circle);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${side}/${circle}: exact source hit`);
    assert.equal(f.state.pendingAbility.side, side, `${side}/${circle}: private choice follows controller`);
    const wrongAuth = authFor(side === "human" ? "bot" : "human");
    assert.equal(resolveHit(f, true, wrongAuth).ok, false, `${side}/${circle}: opponent cannot pay or resolve`);
    const paid = resolveHit(f, true);
    assert.equal(paid.ok, true, `${side}/${circle}: ${paid.reason || ""}`);
    assert.equal(f.own.damage[0].faceDown, true, `${side}/${circle}: Counter-Blast paid`);
    assert.equal(f.own.soul.length, 3, `${side}/${circle}: Soul-Charge 3 resolves`);
    assert.equal(f.other.soul.length, 0, `${side}/${circle}: opponent's Soul unchanged`);
  }
  const declined = hitFixture("human", "vanguard");
  Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine);
  assert.equal(resolveHit(declined, false).ok, true);
  assert.equal(declined.own.damage[0].faceDown, false, "declining does not pay Counter-Blast");
  assert.equal(declined.own.soul.length, 0, "declining does not Soul-Charge");
  const wrongClan = hitFixture("human", "rear-left", { wrongClan: true });
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0, "wrong Vanguard clan does not prompt");
  const noCost = hitFixture("human", "vanguard", { faceUpDamage: 0 });
  assert.equal(Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine).queued.length, 1, "the attack-hit trigger occurs independently of whether its optional cost is payable");
  assert.equal(resolveHit(noCost, true).ok, false, "unpayable Counter-Blast prevents effect resolution");
  assert.equal(noCost.own.soul.length, 0, "unpayable cost does not partially Soul-Charge");
  const unrelated = hitFixture("human", "rear-left");
  const otherAttacker = instance("cfa-3", "unrelated-attacker", unrelated.ownerId, { zone: "rear-guard", circle: "rear-right" });
  unrelated.own.rear[1] = otherAttacker;
  unrelated.state.pendingAttack.attackerUid = otherAttacker.uid;
  const otherHit = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: undefined,
    sourceCardInstanceId: otherAttacker.uid, sourceOwnerPlayerId: unrelated.ownerId, sourceControllerPlayerId: unrelated.ownerId,
    attackingUnitInstanceId: otherAttacker.uid, currentLocation: "rear-right" });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherHit], Engine).queued.length, 0, "another unit's hit does not trigger this source");
  const noVanguardHit = hitFixture("human", "rear-left");
  const rearHit = Engine.createGameEvent(noVanguardHit.state, { ...noVanguardHit.event, eventId: undefined, targetLocation: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(noVanguardHit.state, [rearHit], Engine).queued.length, 0, "hitting a Rear-Guard does not qualify");
});

test("existing Golden Thief Bug GC protection prompts and resolves only for its controller", () => {
  for (const ownerSide of ["human", "bot"]) {
    const f = gcFixture(ownerSide);
    assert.equal(f.ability.definition.source.patternId, "auto-gc-when-placed-discard-protect-unit-v1");
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, ownerSide);
    assert.equal(f.state.pendingAbility.side, ownerSide);
    const wrongAuth = authFor(ownerSide === "human" ? "bot" : "human");
    const before = JSON.stringify(f.state);
    assert.equal(Reducer.applyAbilityDecision(f.state, { actorAuthUid: wrongAuth, actionId: `gc-wrong-${ownerSide}`,
      expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid,
          costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] } } } }, seats, Engine).ok, false);
    assert.equal(JSON.stringify(f.state), before, `${ownerSide}: rejection is atomic`);
    const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: authFor(ownerSide), actionId: `gc-right-${ownerSide}`,
      expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid,
          costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] } } } }, seats, Engine);
    assert.equal(result.ok, true, `${ownerSide}: ${result.reason || ""}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true, `${ownerSide}: attacked unit cannot be hit`);
    assert.deepEqual(f.state.players[ownerSide].drop.map(item => item.uid), [f.payment.uid], `${ownerSide}: controller pays`);
    assert.deepEqual(f.state.players[ownerSide === "human" ? "bot" : "human"].drop, [], `${ownerSide}: other seat untouched`);
  }
});
