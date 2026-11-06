"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0016.js");
// Evaluate the isolated batch proposal against the real engine/reducer paths.
Engine.registerAbilityDefinitions(batch);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const EXPECTED_IDS = [
  "cfa-11284:0", "cfa-11285:0", "cfa-11286:0", "cfa-11286:1", "cfa-11287:0",
  "cfa-11288:0", "cfa-11289:0", "cfa-11290:0", "cfa-11290:1", "cfa-11291:0",
  "cfa-11291:1", "cfa-11292:0", "cfa-11292:1", "cfa-11293:0", "cfa-11293:1",
  "cfa-11293:2", "cfa-11294:0", "cfa-11294:1", "cfa-11295:0", "cfa-11295:1",
  "cfa-11296:0", "cfa-11297:0", "cfa-11299:0", "cfa-11299:1", "cfa-1129:0",
  "cfa-1129:1", "cfa-11300:0", "cfa-11300:1", "cfa-11301:0", "cfa-11301:1",
  "cfa-11302:0", "cfa-11303:0", "cfa-11303:1", "cfa-11304:0", "cfa-11304:1",
  "cfa-11305:0", "cfa-11306:0", "cfa-11306:1", "cfa-11307:0", "cfa-1130:0",
  "cfa-1130:1"
];
const SUPPORTED = ["cfa-1129:0", "cfa-1129:1", "cfa-1130:0", "cfa-11293:0", "cfa-11306:0", "cfa-11306:1"];
const PROPOSED = ["cfa-11294:1"];
const cardForAbility = id => cards.get(id.slice(0, id.lastIndexOf(":")));
const abilityFor = id => {
  const card = cardForAbility(id);
  assert.ok(card, `catalog includes card for ${id}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `catalog parser preserves ${id}`);
  return { card, ability };
};

function instance(card, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade || 0),
    clan: card.clan, clans: [...(card.clans || [])], power: Number(card.power || 0), shield: Number(card.shield || 0),
    trigger: card.trigger || "", unitCard: true, critical: 1, drive: 1, rested: false, locked: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function gcProtectFixture(cardId, ownerSide) {
  const card = cards.get(cardId);
  const abilityId = `${cardId}:1`;
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = ownerSide === "human" ? "player-guest" : "player-host";
  const clan = ability.costs[0].filter?.clan;
  const paymentCard = clan
    ? catalog.find(item => (item.clans || [item.clan]).includes(clan) && item.type === "Unit")
    : cards.get("cfa-2");
  const targetCard = ability.effects[0].targetFilter?.clan
    ? catalog.find(item => (item.clans || [item.clan]).includes(ability.effects[0].targetFilter.clan) && item.type === "Unit")
    : cards.get("cfa-3");
  assert.ok(paymentCard, `${abilityId} has a legal discard card in the catalog`);
  assert.ok(targetCard, `${abilityId} has a legal attacked unit in the catalog`);
  const source = instance(card, `${cardId}-${ownerSide}-source`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance(paymentCard, `${cardId}-${ownerSide}-payment`, ownerId, { zone: "hand" });
  const target = instance(targetCard, `${cardId}-${ownerSide}-target`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const own = makePlayer(ownerId), opponent = makePlayer(attackerId);
  own.vanguard = instance(cards.get("cfa-3"), `${cardId}-${ownerSide}-own-vg`, ownerId, { zone: "vanguard", circle: "vanguard" });
  own.rear = [target]; own.hand = [payment]; own.guardCircle = [source];
  opponent.vanguard = instance(cards.get("cfa-3"), `${cardId}-${ownerSide}-opp-vg`, attackerId, { zone: "vanguard", circle: "vanguard" });
  const state = {
    matchId: `batch16-gc-${cardId}-${ownerSide}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 3,
    side: attackerSide, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
    players: ownerSide === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId: `battle-${cardId}-${ownerSide}`, attackerSide, attackerUid: opponent.vanguard.uid, attackerZone: "vanguard",
      defenderSide: ownerSide, targetUid: target.uid, targetZone: "rear-left", guardCards: [], power: 18000, targetPower: 10000, critical: 1 }
  };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard-placement", battleId: state.pendingAttack.battleId });
  return { state, source, payment, target, ability, event, ownerSide };
}

function resolveProtect(f, actorAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.ability.id}-${f.ownerSide}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid,
        costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] } } } }, seats, Engine);
}

test("the batch accounts for all 41 exact catalog ability IDs with mutually exclusive outcomes", () => {
  assert.equal(batch.audit.batchId, "ABILITY-76D8A0B8-0016");
  assert.equal(batch.audit.auditedAbilityIds.length, 41);
  assert.equal(new Set(batch.audit.auditedAbilityIds).size, 41);
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, SUPPORTED);
  assert.equal(batch.length, 1, "one exact, reusable continuous-shield definition is proposed");
  assert.deepEqual(batch.audit.proposedDefinitionIds, PROPOSED);
  assert.equal(batch.audit.blocked.length, 34);
  const accounted = [...batch.audit.alreadySupportedAbilityIds, ...batch.audit.proposedDefinitionIds, ...batch.audit.blocked.map(row => row.abilityId)];
  assert.equal(new Set(accounted).size, EXPECTED_IDS.length, "each ID belongs to only one outcome");
  assert.deepEqual([...accounted].sort(), [...EXPECTED_IDS].sort());
  for (const id of EXPECTED_IDS) {
    const { card, ability } = abilityFor(id);
    assert.ok(card.text.includes(ability.printedText), `${id}: exact printed block is preserved in catalog text`);
  }
});

test("all 34 blocked abilities fail closed in the runtime activation and server checks", () => {
  for (const { abilityId, blocker } of batch.audit.blocked) {
    const { ability } = abilityFor(abilityId);
    assert.equal(ability.definition, null, `${abilityId}: no production definition was attached`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId}: authoritative reducer rejects it`);
    if (ability.kind === "ACT") assert.equal(ability.definition, null, `${abilityId}: ACT still has no legal effect program`);
    assert.ok(blocker.length > 45, `${abilityId}: actionable blocker is recorded`);
  }
});

test("existing production patterns retain exact provenance and distinguish passive CONT from AUTO", () => {
  const expectedPatterns = new Map([
    ["cfa-1129:0", "cont-sentinel-keyword-v1"],
    ["cfa-1129:1", "auto-gc-discard-protect-attacked-unit-v1"],
    ["cfa-1130:0", "auto-forerunner-same-clan-ride-call-source-v1"],
    ["cfa-11293:0", "cont-vc-rc-card-name-alias-v1"],
    ["cfa-11306:0", "cont-sentinel-keyword-v1"],
    ["cfa-11306:1", "auto-gc-when-placed-discard-protect-unit-v1"]
  ]);
  for (const [id, pattern] of expectedPatterns) {
    const { ability } = abilityFor(id);
    assert.equal(ability.definition?.source?.patternId, pattern, id);
  }
  for (const id of ["cfa-1129:1", "cfa-1130:0", "cfa-11306:1"]) {
    const { ability } = abilityFor(id);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
  for (const id of ["cfa-1129:0", "cfa-11306:0"]) {
    const { ability } = abilityFor(id);
    assert.equal(ability.kind, "CONT", id);
    assert.equal(ability.trigger, null, id);
    assert.deepEqual(ability.definition.keywords, ["sentinel"], id);
    assert.equal(Engine.isManuallyActivatable(ability), false, id);
  }
  const alias = abilityFor("cfa-11293:0").ability;
  assert.deepEqual(alias.requiredLocation, ["vanguard", "rear-guard"]);
  const source = { id: "cfa-11293", name: "Yamanbagiri Kunihiro Kiwame Sentou" };
  assert.deepEqual(Engine.getCardNames(source, { location: "vanguard" }), [source.name, "Yamanbagiri Kunihiro Kiwame"]);
  assert.deepEqual(Engine.getCardNames(source, { location: "rear-guard" }), [source.name, "Yamanbagiri Kunihiro Kiwame"]);
  assert.deepEqual(Engine.getCardNames(source, { location: "hand" }), [source.name]);
  const officialIds = new Set(batch.audit.officialReferences.map(row => row.abilityId));
  for (const id of ["cfa-1129:0", "cfa-1129:1", "cfa-1130:0", "cfa-11293:0"]) assert.ok(officialIds.has(id), `${id}: Bushiroad source is recorded`);
  assert.deepEqual(batch.audit.provenanceWarnings[0].abilityIds, ["cfa-11306:0", "cfa-11306:1"]);
});

test("existing Forerunner prompts and resolves for the controlling host or joining player only", () => {
  const { card, ability } = abilityFor("cfa-1130:0");
  assert.equal(ability.definition.optional, true);
  assert.equal(ability.canDecline, true);
  const riderCard = catalog.find(item => item.type === "Unit" && item.clan === "Gold Paladin" && Number(item.grade) === 1);
  assert.ok(riderCard, "catalog has a same-clan rider for the Forerunner rule");
  for (const ownerSide of ["human", "bot"]) {
    const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
    const opponentId = ownerSide === "human" ? "player-guest" : "player-host";
    const source = instance(card, `forerunner-source-${ownerSide}`, ownerId);
    const rider = instance(riderCard, `forerunner-rider-${ownerSide}`, ownerId, { zone: "vanguard", circle: "vanguard" });
    const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
    const own = makePlayer(ownerId), opponent = makePlayer(opponentId);
    own.vanguard = rider;
    own.soul = [source];
    opponent.vanguard = instance(cards.get("cfa-3"), `opponent-vg-${ownerSide}`, opponentId, { zone: "vanguard", circle: "vanguard" });
    const state = { matchId: `batch16-forerunner-${ownerSide}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 2,
      side: ownerSide, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
      players: ownerSide === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
    const event = Engine.createGameEvent(state, { type: "card.ridden", actingPlayerId: ownerId, turnPlayerId: ownerId,
      sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, sourceCardClan: riderCard.clan,
      sourceCardClans: riderCard.clans || [riderCard.clan], cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
      subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: "vanguard",
      targetCardInstanceIds: [source.uid], targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
      phase: "ride", timingWindow: "normal-ride" });
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 1, `${ownerSide}: matching clan ride`);
    assert.equal(state.pendingAbility.side, ownerSide, `${ownerSide}: private prompt follows controller`);
    const wrongClanState = structuredClone(state);
    wrongClanState.pendingAbility = null; wrongClanState.pendingAbilities = []; wrongClanState.processedAbilityTriggers = [];
    const wrongClanEvent = Engine.createGameEvent(wrongClanState, { ...event, eventId: undefined, sourceCardClans: ["Kagero"], sourceCardClan: "Kagero" });
    assert.equal(Reducer.discoverAutoTriggers(wrongClanState, [wrongClanEvent], Engine).queued.length, 0, `${ownerSide}: wrong rider clan`);
    const wrongActor = ownerSide === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const rejected = Reducer.applyAbilityDecision(state, { actorAuthUid: wrongActor, actionId: `wrong-seat-${ownerSide}`,
      expectedStateVersion: state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: ability.id } } }, seats, Engine);
    assert.equal(rejected.ok, false, `${ownerSide}: other seat cannot resolve`);
    const actor = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const accepted = Reducer.applyAbilityDecision(state, { actorAuthUid: actor, actionId: `resolve-forerunner-${ownerSide}`,
      expectedStateVersion: state.stateVersion, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: source.uid, abilityId: ability.id, callZone: "rear-left" } } }, seats, Engine);
    assert.equal(accepted.ok, true, `${ownerSide}: ${accepted.reason || ""}`);
    assert.equal(own.rear[0]?.uid, source.uid, `${ownerSide}: exact source called`);
    assert.equal(opponent.rear.every(item => !item), true, `${ownerSide}: opponent board is unchanged`);
  }
});

test("existing Guardian protection resolves only on its owner's side for both assigned cards", () => {
  for (const cardId of ["cfa-1129", "cfa-11306"]) for (const ownerSide of ["human", "bot"]) {
    const f = gcProtectFixture(cardId, ownerSide);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, `${cardId}/${ownerSide}: trusted handler`);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${cardId}/${ownerSide}: exact GC placement`);
    assert.equal(f.state.pendingAbility.side, ownerSide, `${cardId}/${ownerSide}: prompt belongs to controller`);
    const wrongActor = ownerSide === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const before = JSON.stringify(f.state);
    assert.equal(resolveProtect(f, wrongActor).ok, false, `${cardId}/${ownerSide}: opponent cannot pay/resolve`);
    assert.equal(JSON.stringify(f.state), before, `${cardId}/${ownerSide}: rejected action is atomic`);
    const actor = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = resolveProtect(f, actor);
    assert.equal(result.ok, true, `${cardId}/${ownerSide}: ${result.reason || ""}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true, `${cardId}/${ownerSide}: target is protected`);
    assert.deepEqual(f.state.players[ownerSide].drop.map(item => item.uid), [f.payment.uid], `${cardId}/${ownerSide}: controller paid the cost`);
    assert.deepEqual(f.state.players[ownerSide === "human" ? "bot" : "human"].drop, [], `${cardId}/${ownerSide}: opponent resources unchanged`);
  }
});

test("proposed Ookanehira GC shield CONT matches exact Bushiroad text and existing handler contract", () => {
  const { card, ability } = abilityFor("cfa-11294:1");
  const definition = batch.find(item => item.id === "cfa-11294:1");
  assert.ok(definition);
  assert.equal(definition.kind, "CONT");
  assert.equal(definition.cardId, "cfa-11294");
  assert.equal(definition.printedText, ability.printedText);
  assert.ok(card.text.includes(definition.printedText));
  assert.equal(definition.source.dataset, "Bushiroad official card list");
  assert.equal(definition.source.cardNumber, "D-TB04/020EN");
  assert.match(definition.source.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
  assert.equal(definition.source.patternId, "cont-gc-opponent-grade-shield-v1");
  assert.deepEqual(definition.requiredLocation, ["guardian"]);
  assert.deepEqual(definition.effects, [{ op: "continuous-shield", target: "source", amount: 5000, duration: "continuous", condition: { op: "opponent-vanguard-grade-at-least", grade: 3 } }]);
  assert.equal(ability.kind, "CONT");
  assert.deepEqual(ability.requiredLocation, ["guardian"]);
  assert.equal(ability.trigger, null);
  assert.equal(Engine.isManuallyActivatable(ability), false);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), false, "CONT shield is evaluated passively, not as a resolving effect prompt");
  const direct = Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 3 });
  assert.equal(direct.shield, 5000);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 2 }).shield, 0);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "hand", opponentVanguardGrade: 3 }).shield, 0);
  for (const defenderSide of ["human", "bot"]) for (const opponentGrade of [2, 3]) {
    const defenderId = defenderSide === "human" ? "player-host" : "player-guest";
    const attackerSide = defenderSide === "human" ? "bot" : "human";
    const attackerId = defenderSide === "human" ? "player-guest" : "player-host";
    const guardian = instance(card, `ookanehira-${defenderSide}-${opponentGrade}`, defenderId, { zone: "hand" });
    const ownVanguard = instance(cards.get("cfa-1"), `own-vg-${defenderSide}`, defenderId, { zone: "vanguard", circle: "vanguard" });
    const opposingVanguard = instance(cards.get("cfa-1"), `opp-vg-${defenderSide}`, attackerId, { zone: "vanguard", circle: "vanguard", grade: opponentGrade });
    const player = playerId => ({ playerId, vanguard: null, rear: [], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
    const defender = player(defenderId), attacker = player(attackerId);
    defender.vanguard = ownVanguard; defender.hand = [guardian]; attacker.vanguard = opposingVanguard;
    const state = { matchId: `batch16-shield-${defenderSide}-${opponentGrade}`, stateVersion: 1, eventSequence: 0,
      side: attackerSide, turn: 3, phase: 5, firstTurnComplete: true, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
      pendingAbility: null, pendingTrigger: null, pendingAbilities: [], players: defenderSide === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender },
      pendingAttack: { battleId: `shield-battle-${defenderSide}-${opponentGrade}`, attackerSide, attackerPlayerId: attackerId,
        attackerUid: opposingVanguard.uid, attackerZone: "vanguard", defenderSide, defenderPlayerId: defenderId, targetUid: ownVanguard.uid,
        targetZone: "vanguard", power: 30000, targetPower: 10000, critical: 1, guardCards: [], defenderDone: false,
        maxDriveChecks: 1, driveCountChosen: false } };
    const actorAuthUid = defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = Reducer.applyGameAction(state, { actorAuthUid, actionId: `guard-${defenderSide}-${opponentGrade}`,
      expectedStateVersion: state.stateVersion, payload: { type: "game-action", action: "guard", cardInstanceId: guardian.uid } }, seats, Engine);
    assert.equal(result.ok, true, `${defenderSide}/${opponentGrade}: ${result.reason || ""}`);
    const expected = Number(card.shield) + (opponentGrade >= 3 ? 5000 : 0);
    assert.equal(result.state.pendingAttack.targetPower, 10000 + expected, `${defenderSide}/${opponentGrade}: exact shield amount`);
    assert.equal(result.state.pendingAbility ?? null, null, `${defenderSide}/${opponentGrade}: passive CONT creates no prompt`);
  }
});
