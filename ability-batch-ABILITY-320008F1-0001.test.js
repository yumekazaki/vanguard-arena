"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
const curatedDefinitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(curatedDefinitions);
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0001.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const ids = contribution.audit.abilityIds;

function instance(cardId, uid, playerId, extra = {}) {
  const card = cards.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || String(cardId), grade: Number(card?.grade || 0),
    power: Number(card?.power || 0), critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true,
    rested: false, locked: false, ...extra };
}

function attackFixture(side = "human", targetZone = "vanguard", attackerIsOther = false) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance("cfa-100", `source-${side}`, playerId);
  const attacker = attackerIsOther ? instance("cfa-1002", `other-attacker-${side}`, playerId) : source;
  const opponentVanguard = instance("cfa-3", `opponent-vanguard-${side}`, opponentId);
  const opponentRear = instance("cfa-1002", `opponent-rear-${side}`, opponentId);
  const own = { playerId, vanguard: source, rear: [attackerIsOther ? attacker : null, null, null, null, null],
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [opponentRear, null, null, null, null],
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const battleId = `battle-${side}`;
  const attackerLocation = attackerIsOther ? "rear-left" : "vanguard";
  const state = { matchId: `batch-320008f1-${side}`, stateVersion: 1, eventSequence: 0, turn: 3, side, phase: 5,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide: side, attackerUid: attacker.uid, attackerPlayerId: playerId,
      attackerZone: attackerLocation, defenderSide: side === "human" ? "bot" : "human",
      targetUid: targetZone === "vanguard" ? opponentVanguard.uid : opponentRear.uid, targetZone,
      power: attacker.power, critical: 1 },
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId, attackingCardInstanceIds: [attacker.uid],
    previousLocation: attackerLocation, currentLocation: attackerLocation,
    targetCardInstanceIds: [targetZone === "vanguard" ? opponentVanguard.uid : opponentRear.uid], targetLocation: targetZone,
    battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, event, source, side, playerId, attacker, attackPower: attacker.power };
}

function standFixture(side = "human", { phase = "battle", sourceLocation = "rear", subjectIsSource = true, turnPlayerId = null } = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance("cfa-1001", `yamatano-${side}`, playerId);
  const subject = subjectIsSource ? source : instance("cfa-1002", `other-unit-${side}`, playerId);
  const opponentVanguard = instance("cfa-3", `stand-opponent-vanguard-${side}`, opponentId);
  const own = { playerId, vanguard: sourceLocation === "vanguard" ? source : null,
    rear: sourceLocation === "rear" ? [source, subjectIsSource ? null : subject, null, null, null] : Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `batch-320008f1-stand-${side}`, stateVersion: 1, eventSequence: 0, turn: 3, side, phase: 5,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const subjectLocation = subjectIsSource ? sourceLocation === "vanguard" ? "vanguard" : "rear-left" : "rear-right";
  const event = Engine.createGameEvent(state, { type: "unit.stood", actingPlayerId: playerId,
    turnPlayerId: turnPlayerId || playerId, cardInstanceId: subject.uid, subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: subject.ownerPlayerId, subjectControllerPlayerId: subject.controllerPlayerId,
    previousLocation: subjectLocation, currentLocation: subjectLocation, circle: subjectLocation,
    phase, timingWindow: "stand-step", before: { rested: true }, after: { rested: false } });
  return { state, event, source, subject, side, playerId };
}

function decide(f, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.side}-cfa-100-1`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-100:1" } } }, seats, Engine);
}

test("batch manifest matches the assignment and every ID resolves to its exact catalog text", () => {
  const assignments = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments;
  const batches = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches;
  const verification = JSON.parse(fs.readFileSync("card-verification-manifest.json", "utf8"));
  const assignment = assignments.find(item => item.batchId === "ABILITY-320008F1-0001");
  const batch = batches.find(item => item.batchId === "ABILITY-320008F1-0001");
  assert.ok(assignment && batch);
  assert.deepEqual([...ids].sort(), [...assignment.abilityIds].sort());
  const fullyVerifiedIds = new Set(verification.records.filter(record => record.fullyVerified).map(record => record.abilityId));
  const remainingIds = ids.filter(abilityId => !fullyVerifiedIds.has(abilityId));
  assert.deepEqual([...remainingIds].sort(), [...batch.abilityIds].sort());
  assert.deepEqual([...remainingIds].sort(), [...batch.focusAbilityIds].sort());
  for (const abilityId of ids) {
    const [cardId] = abilityId.split(":");
    const card = cards.get(cardId);
    const ability = card && Engine.parseCardAbilities(card).find(item => item.id === abilityId);
    assert.ok(ability, `${abilityId}: parsed from assigned card`);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: exact catalog text preserved`);
    assert.equal(ability.cardId, cardId, `${abilityId}: card association`);
  }
});

test("catalog attack-count UI instructions are stripped from ability text without shifting ability IDs", () => {
  const hints = /SHIFT \+ left click|SHIFT \+ right click|Middle click or hover and press SPACE/;
  for (const [cardId, abilityId] of [["cfa-100", "cfa-100:1"], ["cfa-10636", "cfa-10636:1"], ["cfa-4298", "cfa-4298:1"]]) {
    const card = cards.get(cardId);
    const abilities = Engine.parseCardAbilities(card);
    assert.ok(card.text.match(hints), `${cardId}: original catalog note remains available as source data`);
    assert.equal(abilities.find(item => item.id === abilityId)?.id, abilityId, `${cardId}: ability ID is stable`);
    assert.equal(abilities.some(item => hints.test(item.raw) || hints.test(item.printedText)), false, `${cardId}: UI instructions are not treated as printed skill text`);
  }
});

test("only three new definitions are executable; the rest stay unsupported with concrete blockers", () => {
  assert.deepEqual([...contribution.audit.implementedAbilityIds].sort(), ["cfa-10016:0", "cfa-1001:0", "cfa-100:1"]);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, ["cfa-1002:0"]);
  assert.equal(contribution.audit.unsupportedSiblings.length, 48);
  for (const record of contribution.audit.unsupportedSiblings) {
    assert.ok(ids.includes(record.abilityId), record.abilityId);
    assert.ok(record.catalogPrintedText, `${record.abilityId}: text retained`);
    assert.ok(record.blocker.length > 40, `${record.abilityId}: concrete blocker`);
    assert.equal(record.officialPrintedText, null, `${record.abilityId}: not falsely labeled official-text verified`);
    const [cardId] = record.abilityId.split(":");
    const ability = Engine.parseCardAbilities(cards.get(cardId)).find(item => item.id === record.abilityId);
    assert.equal(ability.printedText, record.catalogPrintedText, `${record.abilityId}: audit text matches exact catalog text`);
    assert.equal(ability.definition, null, `${record.abilityId}: unsupported ability has no placeholder definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${record.abilityId}: unavailable to server resolution`);
    if (ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(ability).ok, false, `${record.abilityId}: AUTO unavailable`);
    if (ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(ability, {}).ok, false, `${record.abilityId}: ACT unavailable`);
    if (ability.kind === "CONT") assert.deepEqual(Engine.evaluateContinuousEffects([ability], { location: "vanguard", isControllerTurn: true }),
      { power: 0, critical: 0, drive: 0 }, `${record.abilityId}: no placeholder CONT effect`);
  }
});

test("cfa-100:1 triggers only from its exact VC attacking a Vanguard and resolves for either seat", () => {
  const proposedDefinition = contribution.find(item => item.id === "cfa-100:1");
  const definition = Engine.parseCardAbilities(cards.get("cfa-100")).find(item => item.id === "cfa-100:1")?.definition;
  assert.ok(definition);
  assert.ok(proposedDefinition);
  assert.equal(definition.source.patternId, "auto-own-attack-vanguard-power-battle-v1");
  assert.deepEqual(definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]);
  assert.ok(cards.get("cfa-100").text.includes(definition.printedText));
  for (const side of ["human", "bot"]) {
    const f = attackFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: own attack queues once`);
    assert.equal(f.state.pendingAbility.side, side, `${side}: only source controller receives the prompt`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Reducer.supportsServerAbilityEffects(f.state.pendingAbility.ability), true);
    assert.equal(Engine.canPayAbilityCosts(f.state.pendingAbility.ability, {}), true, "no printed cost");
    if (side === "bot") assert.equal(decide(f, seats.hostAuthUid).ok, false, "host cannot resolve joiner's AUTO");
    const resolved = decide(f);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolved"}`);
    assert.equal(f.source.turnPowerBoost || 0, 0, "battle-duration power does not persist for the turn");
    assert.equal(f.state.pendingAttack.power, f.attackPower + 3000);
    assert.equal(f.source.power, f.attackPower, "base power remains unchanged");
  }
});

test("cfa-100:1 rejects a different attacker or an attack aimed at a Rear-Guard", () => {
  for (const f of [attackFixture("human", "vanguard", true), attackFixture("human", "rear-guard")]) {
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.some(item => item.ability?.id === "cfa-100:1"), false);
  }
});

test("cfa-1001:0 requires this exact Rear-Guard to stand during its controller's battle phase", () => {
  const definition = curatedDefinitions.find(item => item.id === "cfa-1001:0");
  assert.ok(definition);
  assert.equal(definition.trigger.eventType, "unit.stood");
  assert.equal(definition.trigger.subject, "event-subject");
  assert.deepEqual(definition.trigger.circles, ["rear-guard"]);
  assert.equal(definition.trigger.requiredPhase, "battle");
  assert.equal(definition.trigger.turnRelation, "controller");
  assert.equal(definition.trigger.subjectControllerRelation, "source-controller");
  assert.deepEqual(definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);

  for (const side of ["human", "bot"]) {
    const f = standFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: exact Yamatano Drake stand queues once`);
    assert.equal(f.state.pendingAbility.side, side, `${side}: only the source controller receives the prompt`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side}: prompt names exact card instance`);
    assert.equal(f.state.pendingAbility.eventContext.gameEvent.subjectCardInstanceId, f.source.uid);
    assert.equal(Reducer.supportsServerAbilityEffects(f.state.pendingAbility.ability), true);
    if (side === "bot") {
      const hostCannotResolve = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.hostAuthUid,
        actionId: "host-cannot-resolve-yamatano", expectedStateVersion: f.state.stateVersion,
        payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-1001:0" } } }, seats, Engine);
      assert.equal(hostCannotResolve.ok, false, "host cannot resolve joiner's AUTO");
    }
    const actorAuthUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = Reducer.applyAbilityDecision(f.state, { actorAuthUid,
      actionId: `resolve-${side}-cfa-1001-0`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-1001:0" } } }, seats, Engine);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolved"}`);
    assert.equal(f.source.turnPowerBoost, 3000, `${side}: +3000 is applied to Yamatano Drake until turn end`);
    assert.equal(f.state.pendingAbility, null, `${side}: the prompt is consumed`);
  }
});

test("cfa-1001:0 rejects another unit standing, a non-battle phase, the opponent's turn, or a VC source", () => {
  const invalidCases = [
    standFixture("human", { subjectIsSource: false }),
    standFixture("human", { phase: "main" }),
    standFixture("human", { turnPlayerId: "player-guest" }),
    standFixture("human", { sourceLocation: "vanguard" })
  ];
  for (const f of invalidCases) {
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.some(item => item.ability?.id === "cfa-1001:0"), false,
      `${f.event.phase}/${f.event.currentLocation}/${f.event.subjectCardInstanceId}: must not queue`);
  }
});

test("a drive Stand trigger emits an exact stand event and defers AUTO prompts until trigger choices finish", () => {
  for (const side of ["human", "bot"]) {
    const f = attackFixture(side);
    const { state } = f;
    const owner = f.playerId;
    const battleId = state.pendingAttack.battleId;
    const source = instance("cfa-1001", `yamatano-${side}`, owner, { rested: true, circle: "rear-left" });
    state.players[side].rear[0] = source;
    const checkedStandTrigger = instance("cfa-5", `stand-trigger-${side}`, owner);
    state.players[side].triggerZone.push(checkedStandTrigger);
    state.pendingTrigger = { side, uid: checkedStandTrigger.uid, checkName: "drive", kind: "stand", battleId,
      stage: "stand-target", power: 5000, turnOwner: owner };
    state.pendingCheckCard = { side, uid: checkedStandTrigger.uid, checkKind: "drive", battleId };
    const actorAuthUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const stand = Reducer.applyGameAction(state, { actorAuthUid, actionId: `stand-choice-${side}`,
      expectedStateVersion: 1, payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: source.uid } }, seats, Engine);
    assert.equal(stand.ok, true, `${side}: ${stand.reason || "stand choice applied"}`);
    const stood = stand.events.find(event => event.type === "unit.stood");
    assert.equal(stood?.subjectCardInstanceId, source.uid, `${side}: exact stood card is the event subject`);
    assert.equal(stood?.sourceCardInstanceId, checkedStandTrigger.uid, "the checked trigger remains the effect source");
    assert.equal(stood?.currentLocation, "rear-left");
    assert.equal(stood?.turnPlayerId, owner);
    assert.equal(state.pendingAbilities.some(item => item.ability.id === "cfa-1001:0"), true,
      `${side}: the battle AUTO is queued behind the outstanding trigger power choice`);
    assert.equal(state.pendingAbility, null, `${side}: no overlapping ability prompt while the trigger is still resolving`);

    const power = Reducer.applyGameAction(state, { actorAuthUid, actionId: `trigger-power-choice-${side}`,
      expectedStateVersion: 2, payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: source.uid } }, seats, Engine);
    assert.equal(power.ok, true, `${side}: ${power.reason || "trigger power choice applied"}`);
    assert.equal(state.pendingTrigger, null);
    assert.equal(state.pendingAbility?.ability?.id, "cfa-1001:0", `${side}: queued AUTO is promoted after the trigger finishes`);
    assert.equal(state.pendingAbility.side, side, `${side}: the stood card's controller receives its own prompt`);

    const resolved = Reducer.applyAbilityDecision(state, { actorAuthUid, actionId: `resolve-yamatano-after-trigger-${side}`,
      expectedStateVersion: 3, payload: { type: "ability-response", accept: true,
        selection: { instanceUid: source.uid, abilityId: "cfa-1001:0" } } }, seats, Engine);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "queued AUTO resolved"}`);
    assert.equal(source.turnPowerBoost, 8000, `${side}: trigger power and Yamatano's +3000 both resolve once`);
  }
});

test("cfa-10016:0 is continuous only on VC and observes each nested condition independently", () => {
  const ability = Engine.parseCardAbilities(cards.get("cfa-10016")).find(item => item.id === "cfa-10016:0");
  assert.ok(ability?.definition);
  assert.equal(ability.kind, "CONT");
  assert.equal(Engine.isManuallyActivatable(ability), false);
  const evaluate = (overrides = {}) => Engine.evaluateContinuousEffects([ability], {
    sourceCardId: "cfa-10016", sourceInstanceId: "spectral-dupe-instance", targetInstanceId: "spectral-dupe-instance",
    location: "vanguard", isControllerTurn: true, soulCardNames: ["Spectral Duke Dragon"], opponentVanguardGrade: 3, ...overrides
  });
  assert.deepEqual(evaluate(), { power: 10000, critical: 1, drive: 0 });
  assert.deepEqual(evaluate({ opponentVanguardGrade: 2 }), { power: 10000, critical: 0, drive: 0 });
  assert.deepEqual(evaluate({ soulCardNames: [] }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(evaluate({ isControllerTurn: false }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(evaluate({ location: "rear-guard" }), { power: 0, critical: 0, drive: 0 });
});

test("cfa-10016:0 is included in authoritative attack power and critical for either seated player", () => {
  for (const side of ["human", "bot"]) {
    const playerId = side === "human" ? "player-host" : "player-guest";
    const opponentId = side === "human" ? "player-guest" : "player-host";
    const opponentSide = side === "human" ? "bot" : "human";
    const vanguard = instance("cfa-10016", `spectral-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
    const spectralDuke = instance("cfa-225", `duke-soul-${side}`, playerId, { zone: "soul" });
    const opposingVanguard = instance("cfa-3", `opposing-vg-${side}`, opponentId, { grade: 3, zone: "vanguard", circle: "vanguard" });
    const player = { playerId, vanguard, rear: Array(5).fill(null), soul: [spectralDuke], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
    const opponent = { playerId: opponentId, vanguard: opposingVanguard, rear: Array(5).fill(null), soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
    const state = { matchId: `spectral-cont-${side}`, stateVersion: 0, processedActionIds: [], turn: 2, side, phase: 5, firstTurnComplete: true,
      pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
      players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } };
    const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `spectral-attack-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: vanguard.uid, targetCardInstanceId: opposingVanguard.uid } }, seats, Engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(state.pendingAttack.power, vanguard.power + 10000, `${side}: Controller Soul condition grants power`);
    assert.equal(state.pendingAttack.critical, 2, `${side}: grade-3 opponent condition grants critical`);
  }
});

test("existing cfa-1002:0 remains sourced from the production definition registry", () => {
  const ability = Engine.parseCardAbilities(cards.get("cfa-1002")).find(item => item.id === "cfa-1002:0");
  assert.equal(ability?.definition?.source?.patternId, "auto-own-attack-vanguard-clan-power-battle-v1");
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  assert.equal(contribution.some(item => item.id === "cfa-1002:0"), false, "the batch does not duplicate existing work");
});
