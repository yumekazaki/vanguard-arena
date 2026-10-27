"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function cardDefinition(cardId) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return card;
}

function cardInstance(definition, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(definition.id), cardName: definition.name,
    type: definition.type || "Unit", grade: Number(definition.grade),
    ...(definition.clan ? { clan: definition.clan } : {}),
    ...(Array.isArray(definition.clans) ? { clans: [...definition.clans] } : {}),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function setup(cardId, { defenderTargetZone = "rear", attackTargetUid = "guest-rear", ownerSide = "bot" } = {}) {
  const definition = cardDefinition(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.kind === "AUTO" && item.definition?.effects?.some(step => step.op === "protect-target"));
  assert.ok(ability, `card ${cardId} has a reviewed protect AUTO`);
  assert.equal(ability.definition.effects.some(step => ["discard-from-hand", "conditional-counter-charge"].includes(step.op)), false,
    "this test covers only definitions whose full effect program is server-supported");
  // Reducer discovery intentionally reads only the trusted ability registry.
  // Register this exact catalog-derived fixture definition for this isolated test.
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = ownerSide === "human" ? "host" : "guest", attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "host" : "guest";
  const source = cardInstance(definition, `${ownerSide}-guard`, ownerId, { zone: "guardian", circle: "guardian" });
  const discard = cardInstance(cardDefinition("cfa-2"), `${ownerSide}-discard`, ownerId);
  const target = defenderTargetZone === "vanguard"
    ? cardInstance(cardDefinition("cfa-3"), attackTargetUid, ownerId)
    : cardInstance(cardDefinition("cfa-3"), attackTargetUid, ownerId, { circle: "rear-left" });
  const owner = {
    playerId: ownerId, vanguard: defenderTargetZone === "vanguard" ? target : cardInstance(cardDefinition("cfa-3"), `${ownerSide}-vg`, ownerId),
    rear: defenderTargetZone === "rear" ? [target] : [], hand: [discard], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
    guardCircle: [source], gDeck: [], gZone: [], triggerZone: []
  };
  const attacker = {
    playerId: attackerId, vanguard: cardInstance(cardDefinition("cfa-3"), `${attackerSide}-vg`, attackerId),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const players = ownerSide === "human" ? { human: owner, bot: attacker } : { human: attacker, bot: owner };
  const state = {
    matchId: "protect-target-server", stateVersion: 1, turn: 2, side: attackerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [],
    players,
    pendingAttack: {
      battleId: "battle-protect-1", attackerSide, attackerUid: `${attackerSide}-vg`, attackerZone: "vanguard",
      defenderSide: ownerSide, targetUid: attackTargetUid, targetZone: defenderTargetZone === "vanguard" ? "vanguard" : "rear-left",
      guardCards: [], power: 18000, targetPower: 10000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard-placement", battleId: "battle-protect-1"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1, `${ability.id} queues from the exact Guardian Circle placement`);
  return { state, source, discard, target, ability, ownerSide, authUid: ownerSide === "human" ? "auth-host" : "auth-guest" };
}

function decide(fixture, actorAuthUid, selection, actionId = "resolve-protect") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [fixture.discard.uid], reveal: [] },
      ...selection
    } }
  }, seats, Engine);
}

test("server accepts the 92-card generic GC discard-and-protect pattern for its joining controller", () => {
  const fixture = setup("cfa-5678");
  assert.equal(Reducer.supportsServerEffectOperation("protect-target"), true);
  const result = decide(fixture, fixture.authUid, { targetUid: fixture.target.uid });
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.equal(fixture.state.pendingAttack.blocked, true);
  assert.deepEqual(fixture.state.players[fixture.ownerSide].drop.map(card => card.uid), [fixture.discard.uid]);
  assert.deepEqual(fixture.state.players[fixture.ownerSide === "human" ? "bot" : "human"].drop, []);
});

test("the host can independently resolve their own Guardian discard-and-protect AUTO", () => {
  const fixture = setup("cfa-5678", { ownerSide: "human", attackTargetUid: "host-rear" });
  const result = decide(fixture, fixture.authUid, { targetUid: fixture.target.uid });
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAbility, null);
  assert.deepEqual(fixture.state.players.human.drop.map(card => card.uid), [fixture.discard.uid]);
  assert.deepEqual(fixture.state.players.bot.drop, []);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
});

test("all 92 exact generic Guardian discard-and-protect abilities are registered and server-supported", () => {
  const family = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId === "auto-gc-when-placed-discard-protect-unit-v1") family.push(ability);
  }
  assert.equal(family.length, 92);
  assert.equal(new Set(family.map(ability => ability.id)).size, 92);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition => definition.id === ability.id), ability.id);
    assert.equal(ability.trigger?.eventType, "card.placed", ability.id);
    assert.equal(ability.trigger?.subject, "source", ability.id);
    assert.deepEqual(ability.trigger?.circles, ["guardian"], ability.id);
    assert.equal(ability.definition.effects[0]?.op, "protect-target", ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("attacked-target variant binds to the current attack target and needs no client-supplied target", () => {
  const fixture = setup("cfa-2069");
  const result = decide(fixture, "auth-guest", {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.targetUid, fixture.target.uid);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.equal(fixture.state.players.bot.drop[0].uid, fixture.discard.uid);
});

test("clan-filtered Sentinel protection validates a friendly filtered target", () => {
  const fixture = setup("cfa-15");
  const shadow = cardInstance(cardDefinition("cfa-3"), "guest-shadow-target", "guest", {
    clan: "Shadow Paladin", circle: "rear-left"
  });
  fixture.state.players.bot.rear[0] = shadow;
  fixture.state.pendingAttack.targetUid = shadow.uid;
  fixture.state.pendingAttack.targetZone = "rear-left";
  fixture.target.uid = shadow.uid;
  const cost = cardInstance(cardDefinition("cfa-3"), fixture.discard.uid, "guest", { clan: "Shadow Paladin" });
  fixture.state.players.bot.hand[0] = cost;
  fixture.discard = cost;
  const result = decide(fixture, "auth-guest", { targetUid: shadow.uid });
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.equal(fixture.state.players.bot.drop[0].uid, cost.uid);
});

test("host cannot resolve the joining player's protection or pay their cost", () => {
  const fixture = setup("cfa-5678");
  const before = JSON.stringify(fixture.state);
  const result = decide(fixture, "auth-host", { targetUid: fixture.target.uid });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), before);
});

test("protection rejects missing, unrelated, stale, and illegal targets without paying costs", () => {
  const missing = setup("cfa-5678");
  const missingBefore = JSON.stringify(missing.state);
  const noTarget = decide(missing, "auth-guest", {});
  assert.equal(noTarget.ok, false);
  assert.equal(noTarget.reason, "missing-ability-target");
  assert.equal(JSON.stringify(missing.state), missingBefore);

  const unrelated = setup("cfa-5678");
  const unrelatedCard = cardInstance(cardDefinition("cfa-3"), "guest-other", "guest", { circle: "rear-right" });
  unrelated.state.players.bot.rear.push(unrelatedCard);
  const beforeWrongTarget = JSON.stringify(unrelated.state);
  const wrongTarget = decide(unrelated, "auth-guest", { targetUid: unrelatedCard.uid }, "wrong-target");
  assert.equal(wrongTarget.ok, false);
  assert.equal(wrongTarget.reason, "protection-target-is-not-being-attacked");
  assert.equal(JSON.stringify(unrelated.state), beforeWrongTarget);

  const stale = setup("cfa-2069");
  const staleBefore = JSON.stringify(stale.state);
  const staleTarget = decide(stale, "auth-guest", { targetUid: "different-card" }, "stale-target");
  assert.equal(staleTarget.ok, false);
  assert.equal(staleTarget.reason, "stale-or-invalid-protection-target");
  assert.equal(JSON.stringify(stale.state), staleBefore);

  const illegal = setup("cfa-5678");
  illegal.state.players.bot.rear[0].type = "Order";
  const illegalBefore = JSON.stringify(illegal.state);
  const illegalType = decide(illegal, "auth-guest", { targetUid: illegal.target.uid }, "illegal-unit-type");
  assert.equal(illegalType.ok, false);
  assert.equal(illegalType.reason, "ability-target-filter-not-met");
  assert.equal(JSON.stringify(illegal.state), illegalBefore);
});

test("protection rejects if the attack no longer belongs to the source controller's defense", () => {
  const fixture = setup("cfa-5678");
  fixture.state.pendingAttack.defenderSide = "human";
  const before = JSON.stringify(fixture.state);
  const result = decide(fixture, "auth-guest", { targetUid: fixture.target.uid });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "protection-battle-not-defending-controller");
  assert.equal(JSON.stringify(fixture.state), before);
});

test("server gate keeps the conditional-discard and named-drop Counter Charge families unsupported", () => {
  assert.equal(Reducer.supportsServerEffectOperation("discard-from-hand"), false);
  assert.equal(Reducer.supportsServerEffectOperation("conditional-counter-charge"), false);
  for (const id of ["cfa-13984", "cfa-2549"]) {
    const ability = Engine.parseCardAbilitiesCached(cardDefinition(id)).find(item => item.definition?.effects?.some(step => step.op === "protect-target"));
    assert.ok(ability);
    assert.ok(ability.definition.effects.some(step => ["discard-from-hand", "conditional-counter-charge"].includes(step.op)));
    assert.equal(ability.definition.effects.every(step => Reducer.supportsServerEffectOperation(step.op)), false);
  }
});
