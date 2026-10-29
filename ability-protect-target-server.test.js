"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const cardRules = require("./card-authoritative-rules-metadata.js").byId;
const normalizeTrait = value => String(value || "").trim().toLocaleLowerCase().replace(/^the\s+/, "");

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

function setup(cardId, { defenderTargetZone = "rear", attackTargetUid = "guest-rear", ownerSide = "bot", abilityId = null } = {}) {
  const definition = cardDefinition(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.kind === "AUTO" && item.definition?.effects?.some(step => step.op === "protect-target") && (!abilityId || item.id === abilityId));
  assert.ok(ability, `card ${cardId} has a reviewed protect AUTO`);
  assert.equal(ability.definition.effects.some(step => ["discard-from-hand", "conditional-counter-charge"].includes(step.op)), false,
    "this test covers only definitions whose full effect program is server-supported");
  // Reducer discovery must work from the production registry without test-only registration.
  if (ability.definition.source?.patternId === "auto-gc-discard-protect-attacked-unit-v1") {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(definition.id).some(item => item.id === ability.id), `${ability.id} is trusted in production`);
  } else {
    Engine.registerAbilityDefinitions([ability.definition]);
  }
  const ownerId = ownerSide === "human" ? "host" : "guest", attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "host" : "guest";
  const source = cardInstance(definition, `${ownerSide}-guard`, ownerId, { zone: "guardian", circle: "guardian" });
  const discardCost = ability.costs?.find(cost => cost.type === "discard");
  const discardTrait = discardCost?.filter?.clan || discardCost?.filter?.race;
  const discardDefinition = discardTrait
    ? catalog.find(item => (item.type || "Unit") === "Unit" && ([item.clan, ...(item.clans || [])].some(trait => normalizeTrait(trait) === normalizeTrait(discardTrait)) || (cardRules[String(item.id)]?.races || []).includes(discardTrait)))
    : cardDefinition("cfa-2");
  assert.ok(discardDefinition, `${ability.id} has a catalog card for its filtered discard cost`);
  const discard = cardInstance(discardDefinition, `${ownerSide}-discard`, ownerId);
  const protect = ability.definition.effects.find(step => step.op === "protect-target");
  const filter = protect.targetFilter || {};
  const requiredTargetZone = filter.zone === "vanguard" ? "vanguard" : defenderTargetZone;
  const targetDefinition = filter.clan || filter.race
    ? catalog.find(item => (item.type || "Unit") === "Unit" && (filter.clan
      ? [item.clan, ...(item.clans || [])].some(trait => normalizeTrait(trait) === normalizeTrait(filter.clan))
      : (cardRules[String(item.id)]?.races || []).includes(filter.race)))
    : cardDefinition("cfa-3");
  assert.ok(targetDefinition, `${ability.id} has a catalog card for its target filter`);
  const target = requiredTargetZone === "vanguard"
    ? cardInstance(targetDefinition, attackTargetUid, ownerId)
    : cardInstance(targetDefinition, attackTargetUid, ownerId, { circle: "rear-left" });
  const owner = {
    playerId: ownerId, vanguard: requiredTargetZone === "vanguard" ? target : cardInstance(cardDefinition("cfa-3"), `${ownerSide}-vg`, ownerId),
    rear: requiredTargetZone === "rear" ? [target] : [], hand: [discard], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
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
      defenderSide: ownerSide, targetUid: attackTargetUid, targetZone: requiredTargetZone === "vanguard" ? "vanguard" : "rear-left",
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

test("all 73 exact filtered Guardian protect abilities resolve for their owning host and joining player", () => {
  const family = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId === "auto-gc-discard-protect-attacked-unit-v1") family.push(ability);
  }
  assert.equal(family.length, 73);
  for (const ability of family) for (const ownerSide of ["human", "bot"]) {
    const defenderTargetZone = ability.definition.effects[0]?.targetFilter?.zone === "vanguard" ? "vanguard" : "rear";
    const fixture = setup(ability.cardId, { abilityId: ability.id, ownerSide, defenderTargetZone, attackTargetUid: `${ownerSide}-target` });
    const actorAuthUid = ownerSide === "human" ? "auth-host" : "auth-guest";
    const result = decide(fixture, actorAuthUid, { targetUid: fixture.target.uid }, `resolve-${ability.id}-${ownerSide}`);
    assert.equal(result.ok, true, JSON.stringify({ abilityId: ability.id, ownerSide, result, discard: fixture.discard, costs: fixture.ability.costs }, null, 2));
    assert.equal(fixture.state.pendingAttack.perfectGuard, true, ability.id);
    assert.deepEqual(fixture.state.players[ownerSide].drop.map(card => card.uid), [fixture.discard.uid], ability.id);
    assert.deepEqual(fixture.state.players[ownerSide === "human" ? "bot" : "human"].drop, [], ability.id);
  }
});

test("filtered clan and race Guardian costs and targets reject mismatches without partial payment", () => {
  const raceCost = setup("cfa-4187", { ownerSide: "bot" });
  assert.deepEqual(raceCost.ability.costs[0].filter, { race: "Zodiac Time Beast" });
  raceCost.state.players.bot.hand[0].cardId = "cfa-2";
  const wrongRaceBefore = JSON.stringify(raceCost.state);
  const wrongRace = decide(raceCost, "auth-guest", { targetUid: raceCost.target.uid }, "wrong-race-cost");
  assert.equal(wrongRace.ok, false);
  assert.equal(JSON.stringify(raceCost.state), wrongRaceBefore);

  const clanTarget = setup("cfa-189", { ownerSide: "bot" });
  clanTarget.state.players.bot.rear[0].cardId = "cfa-3";
  const wrongClanBefore = JSON.stringify(clanTarget.state);
  const wrongClan = decide(clanTarget, "auth-guest", { targetUid: clanTarget.target.uid }, "wrong-clan-target");
  assert.equal(wrongClan.ok, false);
  assert.equal(JSON.stringify(clanTarget.state), wrongClanBefore);

  const hostProxyBefore = JSON.stringify(raceCost.state);
  const hostProxy = decide(raceCost, "auth-host", { targetUid: raceCost.target.uid }, "host-cannot-proxy-race-protect");
  assert.equal(hostProxy.ok, false);
  assert.equal(hostProxy.reason, "source-not-controlled");
  assert.equal(JSON.stringify(raceCost.state), hostProxyBefore);
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
  illegal.state.players.bot.rear[0].cardId = "test-order-target";
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
