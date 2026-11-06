"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batchDefinitions = require("./ability-contributions/batch-ABILITY-76D8A0B8-0023.js");
Engine.registerAbilityDefinitions(batchDefinitions);
const batch = batchDefinitions.audit;
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsed = new Map();
for (const card of catalog) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), deck: [], drop: [], hand: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });

function cardInstance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  return {
    uid, cardId, cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade || 0), clan: definition.clan,
    clans: [...(definition.clans || (definition.clan ? [definition.clan] : []))],
    power: Number(definition.power || 0), shield: Number(definition.shield || 0),
    trigger: definition.trigger || "", unitCard: true, critical: 1, rested: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function guardianFixture(ownerSide, overrides = {}) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = ownerSide === "human" ? "player-guest" : "player-host";
  const source = cardInstance("cfa-11511", `source-${ownerSide}`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = cardInstance("cfa-2", `payment-${ownerSide}`, ownerId, { zone: "hand" });
  const target = cardInstance("cfa-3", `target-${ownerSide}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const own = player(ownerId), opponent = player(attackerId);
  own.vanguard = target;
  own.hand = overrides.noPayment ? [] : [payment];
  own.guardCircle = [source];
  opponent.vanguard = cardInstance("cfa-3", `attacker-${ownerSide}`, attackerId, { zone: "vanguard", circle: "vanguard" });
  const state = {
    matchId: `batch-0023-gc-${ownerSide}`, stateVersion: 1, eventSequence: 0, turn: 4,
    phase: "guard", side: attackerSide, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    players: ownerSide === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: {
      battleId: `battle-${ownerSide}`, attackerSide, attackerPlayerId: attackerId,
      attackerUid: opponent.vanguard.uid, attackerZone: "vanguard", defenderSide: ownerSide,
      defenderPlayerId: ownerId, targetUid: target.uid, targetZone: "vanguard",
      power: 18000, targetPower: 10000, critical: 1, guardCards: []
    }
  };
  const event = Engine.createGameEvent(state, {
    eventId: `placed-${ownerSide}`, type: "card.placed", actingPlayerId: ownerId,
    turnPlayerId: attackerId, sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: overrides.previousLocation || "hand",
    currentLocation: overrides.circle === "rear-left" ? "rear-left" : "guardian",
    circle: overrides.circle || "guardian", phase: "guard", timingWindow: "guard-placement",
    battleId: `battle-${ownerSide}`
  });
  return { state, source, payment, target, own, opponent, ownerSide, ownerId, event,
    ability: parsed.get("cfa-11511:1") };
}

function respond(f, actorAuthUid, selection, actionId) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection }
  }, seats, Engine);
}

test("all 36 reserved abilities have exact catalog text and an explicit compiled-or-blocked status", () => {
  const assignment = require("./ability-work-batches.json").batches
    .find(candidate => candidate.batchId === batch.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...batch.auditedAbilityIds].sort());
  assert.equal(batch.auditedAbilityIds.length, 36);
  assert.equal(new Set(batch.auditedAbilityIds).size, 36);
  assert.deepEqual(batch.alreadySupportedAbilityIds, ["cfa-11511:0", "cfa-11511:1", "cfa-11518:0"]);
  assert.equal(batch.supportedDefinitions.length, 3);
  assert.equal(batch.unsupportedAbilities.length, 33);
  assert.deepEqual(batch.proposedDefinitions, []);

  const supported = new Set(batch.alreadySupportedAbilityIds);
  const blocked = new Map(batch.unsupportedAbilities.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 33);
  for (const abilityId of batch.auditedAbilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `catalog parser has ${abilityId}`);
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")), abilityId);
    assert.ok(ability.printedText.length > 10, abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} is compiled`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(blocked.has(abilityId), false);
    } else {
      assert.equal(ability.definition, null, `${abilityId} is still unsupported`);
      const record = blocked.get(abilityId);
      assert.ok(record, `blocker record exists for ${abilityId}`);
      assert.equal(record.catalogPrintedText, ability.printedText);
      assert.equal(record.catalogSource, cards.get(ability.cardId).source);
      assert.ok(record.blocker.length > 45, abilityId);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), batch.auditedAbilityIds.filter(id => !supported.has(id)).sort());
});

test("the compiled subset resolves existing Guardian and deck-placement patterns without changing production", () => {
  const expectedPatterns = new Map([
    ["cfa-11511:0", "cont-sentinel-keyword-v1"],
    ["cfa-11511:1", "auto-gc-when-placed-discard-protect-unit-v1"],
    ["cfa-11518:0", "auto-rc-deck-placement-power-turn-v1"]
  ]);
  for (const abilityId of batch.alreadySupportedAbilityIds) {
    const ability = parsed.get(abilityId);
    assert.equal(ability.definition.source.patternId, expectedPatterns.get(abilityId));
    if (ability.kind === "AUTO") assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
  }
  const sentinel = parsed.get("cfa-11511:0");
  assert.equal(sentinel.kind, "CONT");
  assert.ok(sentinel.definition.keywords.includes("sentinel"));
  assert.equal(Engine.isManuallyActivatable(sentinel), false);
});

test("Wisdomclaw resolves only its own Deck-to-RC placement, for its controller", () => {
  function fixture({ side = "human", sourceUid, previousLocation = "deck", circle = "rear-guard", placeSource = true } = {}) {
    const card = cards.get("cfa-11518"), ability = parsed.get("cfa-11518:0");
    const playerId = side === "human" ? "player-host" : "player-guest";
    const opponentId = side === "human" ? "player-guest" : "player-host";
    const source = cardInstance("cfa-11518", `wisdomclaw-${side}`, playerId, { zone: "rear", circle: "rear-left" });
    const own = player(playerId), opponent = player(opponentId);
    if (placeSource) own.rear[0] = source;
    const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
    const state = { matchId: `batch-0023-wisdomclaw-${side}`, stateVersion: 1, turn: 2, side, phase: 4,
      eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
      pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
    const eventSourceUid = sourceUid || source.uid;
    const event = Engine.createGameEvent(state, { eventId: `wisdomclaw-${side}-${previousLocation}-${circle}-${eventSourceUid}`,
      type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
      sourceCardInstanceId: eventSourceUid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
      subjectCardInstanceId: eventSourceUid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
      previousLocation, currentLocation: circle === "rear-guard" ? "rear-left" : circle, circle,
      phase: "main", timingWindow: "call-from-deck" });
    return { state, event, source, ability, side, playerId };
  }

  const valid = fixture({ side: "bot" });
  const discovered = Reducer.discoverAutoTriggers(valid.state, [valid.event], Engine);
  assert.equal(discovered.queued.length, 1);
  assert.equal(valid.state.pendingAbility.side, "bot");
  assert.equal(valid.state.pendingAbility.instance.uid, valid.source.uid);
  assert.equal(valid.state.pendingAbility.triggerControllerPlayerId, valid.playerId);
  const beforeWrongActor = JSON.stringify(valid.state);
  assert.equal(Reducer.applyAbilityDecision(valid.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "batch-0023-wrong-controller", expectedStateVersion: valid.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: valid.source.uid, abilityId: valid.ability.id } }
  }, seats, Engine).ok, false);
  assert.equal(JSON.stringify(valid.state), beforeWrongActor);
  const applied = Reducer.applyAbilityDecision(valid.state, {
    actorAuthUid: seats.guestAuthUid, actionId: "batch-0023-right-controller", expectedStateVersion: valid.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: valid.source.uid, abilityId: valid.ability.id } }
  }, seats, Engine);
  assert.equal(applied.ok, true, applied.reason);
  assert.equal(valid.source.turnPowerBoost, 5000);

  for (const invalid of [
    fixture({ sourceUid: "another-copy" }), fixture({ previousLocation: "hand" }),
    fixture({ circle: "vanguard" }), fixture({ placeSource: false })
  ]) {
    const result = Reducer.discoverAutoTriggers(invalid.state, [invalid.event], Engine);
    assert.equal(result.queued.length, 0);
    assert.equal(invalid.state.pendingAbility, null);
    assert.equal(invalid.source.turnPowerBoost, undefined);
  }
});

test("the compiled GC AUTO prompts and resolves only for its defending controller on both seats", () => {
  for (const ownerSide of ["human", "bot"]) {
    const f = guardianFixture(ownerSide);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, ownerSide);
    assert.equal(f.state.pendingAbility.side, ownerSide);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const correctAuth = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const wrongAuth = ownerSide === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const choice = { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid,
      costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] } };
    const beforeWrongActor = JSON.stringify(f.state);
    assert.equal(respond(f, wrongAuth, choice, `wrong-seat-${ownerSide}`).ok, false);
    assert.equal(JSON.stringify(f.state), beforeWrongActor);
    const result = respond(f, correctAuth, choice, `right-seat-${ownerSide}`);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.pendingAttack.perfectGuard, true);
    assert.deepEqual(f.state.players[ownerSide].drop.map(card => card.uid), [f.payment.uid]);
    assert.deepEqual(f.state.players[ownerSide === "human" ? "bot" : "human"].drop, []);
  }
});

test("GC placement rejects a wrong zone, unavailable discard, and an opponent target without partial effects", () => {
  const wrongCircle = guardianFixture("human", { circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

  const noCost = guardianFixture("human", { noPayment: true });
  const noCostResult = Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine);
  if (noCostResult.queued.length) {
    const selection = { instanceUid: noCost.source.uid, abilityId: noCost.ability.id, targetUid: noCost.target.uid,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] } };
    const before = JSON.stringify(noCost.state);
    assert.equal(respond(noCost, seats.hostAuthUid, selection, "no-discard-payment").ok, false);
    assert.equal(JSON.stringify(noCost.state), before);
  } else {
    assert.equal(noCost.state.pendingAbility, null);
    assert.equal(noCost.state.pendingAttack.perfectGuard, undefined);
  }

  const wrongTarget = guardianFixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 1);
  const opposingVanguard = wrongTarget.opponent.vanguard;
  const invalidSelection = { instanceUid: wrongTarget.source.uid, abilityId: wrongTarget.ability.id,
    targetUid: opposingVanguard.uid, costSelections: { cb: [], sb: [], discard: [wrongTarget.payment.uid], reveal: [] } };
  const beforeInvalidTarget = JSON.stringify(wrongTarget.state);
  assert.equal(respond(wrongTarget, seats.guestAuthUid, invalidSelection, "opponent-target").ok, false);
  assert.equal(JSON.stringify(wrongTarget.state), beforeInvalidTarget);
});

test("official references cover only checked card entries and unsupported text stays blocked", () => {
  assert.equal(batch.verifiedOfficialAbilities.length, 8);
  for (const item of batch.verifiedOfficialAbilities) {
    assert.ok(batch.auditedAbilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/\?cardno=/);
    assert.ok(item.status.includes("checked"));
  }
  for (const abilityId of ["cfa-11516:0", "cfa-11517:0", "cfa-11518:1", "cfa-11529:0", "cfa-11530:0", "cfa-11539:0"]) {
    assert.equal(parsed.get(abilityId).definition, null, `${abilityId} remains blocked despite official text check`);
  }
});
