"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const registeredDefinitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(registeredDefinitions);
const definitions = registeredDefinitions.filter(definition => ["cfa-1304:1", "cfa-1573:1", "cfa-716:1"].includes(definition.id));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const official = new Map([
  ["cfa-1304:1", { name: "Adamantine Celestial, Aniel", number: "BT11/009EN", clan: "Angel Feather", ref: "https://en.cf-vanguard.com/cardlist/?cardno=BT11%2F009EN" }],
  ["cfa-1573:1", { name: "Tetra Magus", number: "EB07/007EN", clan: "Oracle Think Tank", ref: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=35&view=text" }],
  ["cfa-716:1", { name: "Pure Keeper, Requiel", number: "BT06/012EN", clan: "Angel Feather", ref: "https://en.cf-vanguard.com/cardlist/?cardno=BT06%2F012EN" }]
]);

function cardDefinition(cardId) {
  const card = byId.get(String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return card;
}

function instance(definition, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(definition.id), cardName: definition.name,
    type: definition.type || "Unit", grade: Number(definition.grade),
    clan: definition.clan, clans: [...(definition.clans || [])],
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function setup(abilityId, ownerSide = "bot", { sourceFrom = "hand" } = {}) {
  const metadata = official.get(abilityId);
  assert.ok(metadata, `reviewed official card mapping exists for ${abilityId}`);
  const [cardId] = abilityId.split(":");
  const definition = cardDefinition(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === abilityId);
  assert.ok(ability?.definition, `${abilityId} has the registered structured definition`);
  assert.equal(ability.definition.source.patternId, "auto-gc-discard-protect-attacked-unit-v1");

  const ownerId = ownerSide === "human" ? "host" : "guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "host" : "guest";
  const source = instance(definition, `${ownerSide}-${cardId}-source`, ownerId, { zone: "guardian", circle: "guardian" });
  const matching = catalog.find(card => (card.type || "Unit") === "Unit" && (card.clan === metadata.clan || (card.clans || []).includes(metadata.clan)));
  assert.ok(matching, `catalog has a ${metadata.clan} unit for cost and target tests`);
  const discard = instance(matching, `${ownerSide}-matching-discard`, ownerId, { zone: "hand" });
  const target = instance(matching, `${ownerSide}-attacked-target`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const owner = {
    playerId: ownerId,
    vanguard: instance(cardDefinition("cfa-3"), `${ownerSide}-vg`, ownerId, { zone: "vanguard", circle: "vanguard" }),
    rear: [target], hand: [discard], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
    guardCircle: [source], gDeck: [], gZone: [], triggerZone: []
  };
  const attacker = {
    playerId: attackerId,
    vanguard: instance(cardDefinition("cfa-3"), `${attackerSide}-vg`, attackerId, { zone: "vanguard", circle: "vanguard" }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const state = {
    matchId: "gc-clan-protect-batch", stateVersion: 1, turn: 2, side: attackerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [],
    players: ownerSide === "human" ? { human: owner, bot: attacker } : { human: attacker, bot: owner },
    pendingAttack: {
      battleId: "battle-gc-clan-protect", attackerSide, attackerUid: `${attackerSide}-vg`, attackerZone: "vanguard",
      defenderSide: ownerSide, targetUid: target.uid, targetZone: "rear-left",
      guardCards: [], power: 18000, targetPower: 10000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: sourceFrom, currentLocation: "guardian", circle: "guardian",
    timingWindow: "guard-placement", battleId: "battle-gc-clan-protect"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1, `${abilityId} queues for its exact source instance on GC`);
  assert.equal(state.pendingAbility?.triggerControllerPlayerId || state.pendingAbilities[0]?.triggerControllerPlayerId, ownerId);
  return { state, source, discard, target, ability, ownerSide, ownerId, actorAuthUid: ownerSide === "human" ? "auth-host" : "auth-guest" };
}

function decide(fixture, actorAuthUid, extraSelection = {}, actionId = "gc-clan-protect-resolve") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid,
      abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [fixture.discard.uid], reveal: [] },
      targetUid: fixture.target.uid,
      ...extraSelection
    } }
  }, seats, Engine);
}

test("the three assigned Sentinel AUTO texts exactly match official card entries and one handler family", () => {
  assert.equal(definitions.length, 3);
  for (const definition of definitions) {
    const metadata = official.get(definition.id);
    const card = cardDefinition(definition.cardId);
    assert.ok(card.text.includes(definition.printedText), `${definition.id} preserves its exact local printed text`);
    assert.equal(card.name, metadata.name);
    assert.equal(card.clan, metadata.clan);
    assert.equal(definition.source.officialReference, metadata.ref);
    assert.equal(definition.source.officialCardNumber, metadata.number);
    assert.equal(definition.trigger.eventType, "card.placed");
    assert.equal(definition.trigger.subject, "source");
    assert.deepEqual(definition.trigger.circles, ["guardian"]);
    assert.deepEqual(definition.requiredLocation, ["guardian"]);
    assert.equal(definition.optional, true, "the matching discard is optional");
    assert.deepEqual(definition.costs, [{ type: "discard", count: 1, filter: { clan: metadata.clan } }]);
    assert.deepEqual(definition.effects[0].targetFilter, {
      controller: "source-controller", cardType: "unit", clan: metadata.clan, mustBeAttacked: true
    });
    assert.equal(Reducer.supportsServerAbilityEffects(Engine.parseCardAbilitiesCached(card).find(item => item.id === definition.id)), true);
  }
});

test("host and joining player each pay and protect with their own exact clan-filtered Sentinel", () => {
  for (const definition of definitions) for (const ownerSide of ["human", "bot"]) {
    const fixture = setup(definition.id, ownerSide);
    const result = decide(fixture, fixture.actorAuthUid, {}, `resolve-${definition.id}-${ownerSide}`);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fixture.state.pendingAttack.perfectGuard, true);
    assert.equal(fixture.state.pendingAttack.battleId, "battle-gc-clan-protect", "the sentinel prevents a hit without ending the battle or skipping drive checks");
    assert.notEqual(fixture.state.pendingAttack.closing, true);
    assert.deepEqual(fixture.state.players[ownerSide].drop.map(card => card.uid), [fixture.discard.uid]);
    assert.deepEqual(fixture.state.players[ownerSide === "human" ? "bot" : "human"].drop, []);
    assert.equal(fixture.state.pendingAbilities.length, 0);
  }
});

test("GC placement from a non-hand effect still triggers the exact source AUTO", () => {
  const fixture = setup("cfa-1304:1", "bot", { sourceFrom: "rear-guard" });
  const result = decide(fixture, "auth-guest", {}, "gc-clan-protect-nonhand-call");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
});

test("another card's GC placement and this card's placement outside GC do not trigger", () => {
  const fixture = setup("cfa-1304:1");
  const base = {
    actingPlayerId: "guest", turnPlayerId: "host",
    sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest",
    subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest",
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian",
    timingWindow: "guard-placement", battleId: "battle-gc-clan-protect"
  };
  const unrelated = Engine.createGameEvent(fixture.state, {
    ...base, type: "card.placed", sourceCardInstanceId: "other-sentinel", cardInstanceId: "other-sentinel", subjectCardInstanceId: "other-sentinel"
  });
  const unrelatedResult = Reducer.discoverAutoTriggers(fixture.state, [unrelated], Engine);
  assert.equal(unrelatedResult.queued.length, 0);

  const wrongCircle = Engine.createGameEvent(fixture.state, {
    ...base, type: "card.placed", sourceCardInstanceId: fixture.source.uid,
    cardInstanceId: fixture.source.uid, subjectCardInstanceId: fixture.source.uid,
    currentLocation: "rear-guard", circle: "rear-guard"
  });
  const wrongCircleResult = Reducer.discoverAutoTriggers(fixture.state, [wrongCircle], Engine);
  assert.equal(wrongCircleResult.queued.length, 0);
});

test("wrong actor, wrong discarded clan, and wrong attacked target are rejected without partial changes", () => {
  const proxy = setup("cfa-1573:1", "bot");
  const proxyBefore = JSON.stringify(proxy.state);
  const hostCannotProxy = decide(proxy, "auth-host", {}, "wrong-seat-cannot-resolve-guest-sentinel");
  assert.equal(hostCannotProxy.ok, false);
  assert.equal(hostCannotProxy.reason, "source-not-controlled");
  assert.equal(JSON.stringify(proxy.state), proxyBefore);

  const wrongCost = setup("cfa-1304:1", "bot");
  const offClan = cardDefinition("cfa-2");
  wrongCost.state.players.bot.hand[0] = instance(offClan, wrongCost.discard.uid, "guest", { zone: "hand" });
  const wrongCostBefore = JSON.stringify(wrongCost.state);
  const costRejected = decide(wrongCost, "auth-guest", {}, "wrong-clan-sentinel-discard");
  assert.equal(costRejected.ok, false);
  assert.equal(JSON.stringify(wrongCost.state), wrongCostBefore);

  const wrongTarget = setup("cfa-716:1", "human");
  const unrelated = instance(cardDefinition("cfa-3"), "host-unattacked-unit", "host", { zone: "rear-guard", circle: "rear-center" });
  wrongTarget.state.players.human.rear.push(unrelated);
  const targetBefore = JSON.stringify(wrongTarget.state);
  const targetRejected = decide(wrongTarget, "auth-host", { targetUid: unrelated.uid }, "not-current-attacked-target");
  assert.equal(targetRejected.ok, false);
  assert.equal(JSON.stringify(wrongTarget.state), targetBefore);
});

test("declining the optional cost clears only that player's prompt and changes no cards", () => {
  const fixture = setup("cfa-1304:1", "bot");
  const before = JSON.stringify(fixture.state);
  const declined = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: "auth-guest", actionId: "decline-gc-clan-protect",
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } }
  }, seats, Engine);
  assert.equal(declined.ok, true, JSON.stringify(declined));
  assert.equal(fixture.state.pendingAbilities.length, 0);
  assert.deepEqual(fixture.state.players.bot.hand.map(card => card.uid), [fixture.discard.uid]);
  assert.deepEqual(fixture.state.players.bot.drop, []);
  assert.notEqual(JSON.stringify(fixture.state), before, "declining consumes the prompt, not the card or attack");
});
