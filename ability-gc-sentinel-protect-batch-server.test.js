"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const BATCH = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === "auto-gc-sentinel-protect-friendly-unit-v1")
  .map(ability => ({ cardId: String(card.id), abilityId: ability.id })));
const cardById = id => catalog.find(card => String(card.id) === String(id));
const unit = card => /unit/i.test(String(card?.type || ""));

function matchingCard(filter = {}) {
  return catalog.find(card => unit(card) && (!filter.clan || card.clan === filter.clan) && (!filter.race || card.race === filter.race));
}

function instance(card, uid, playerId, extras = {}) {
  assert.ok(card, `a catalog card exists for ${uid}`);
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extras };
}

function fixture(cardId, ownerSide = "bot") {
  const printed = cardById(cardId);
  assert.ok(printed, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(printed).find(item => item.definition?.source?.patternId === "auto-gc-sentinel-protect-friendly-unit-v1");
  assert.ok(ability, `${cardId} has the reviewed Guardian Sentinel ability`);
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "player-host" : "player-guest";
  const costCard = matchingCard(ability.costs[0].filter || {}) || (Object.keys(ability.costs[0].filter || {}).length ? null : cardById("cfa-2"));
  const targetFilter = ability.effects[0].targetFilter;
  const targetCard = matchingCard(targetFilter) || (Object.keys(targetFilter).length === 2 ? cardById("cfa-2") : null);
  const source = instance(printed, `source-${cardId}-${ownerSide}`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance(costCard, `cost-${cardId}-${ownerSide}`, ownerId);
  const target = instance(targetCard, `target-${cardId}-${ownerSide}`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const otherVanguard = instance(cardById("cfa-3"), `opponent-vg-${ownerSide}`, attackerId, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const ownVanguard = instance(cardById("cfa-3"), `own-vg-${ownerSide}`, ownerId, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? ownVanguard : otherVanguard, rear: ownerSide === "human" ? [target] : [], hand: ownerSide === "human" ? [payment] : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "human" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? ownVanguard : otherVanguard, rear: ownerSide === "bot" ? [target] : [], hand: ownerSide === "bot" ? [payment] : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "bot" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "gc-sentinel-batch", stateVersion: 1, turn: 2, side: attackerSide, phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], players,
    pendingAttack: { battleId: `battle-${cardId}-${ownerSide}`, attackerSide, attackerUid: otherVanguard.uid, attackerZone: "vanguard", defenderSide: ownerSide, targetUid: target.uid, targetZone: "rear-left", guardCards: [], power: 18000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard" });
  return { state, event, source, payment, target, ability, ownerSide };
}

function resolve(f, { accept = true, authUid, targetUid = f.target.uid, discardUid = f.payment.uid } = {}) {
  const actorAuthUid = authUid || (f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid);
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.source.uid}-${accept}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid, costSelections: { cb: [], sb: [], discard: discardUid ? [discardUid] : [], reveal: [] } } } }, seats, Engine);
}

test("all 28 exact catalog Guardian Sentinel skills are trusted and preserve their individual filters and costs", () => {
  assert.equal(BATCH.length, 28);
  for (const { cardId, abilityId } of BATCH) {
    const ability = Engine.parseCardAbilitiesCached(cardById(cardId)).find(item => item.id === abilityId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === abilityId), abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
    assert.equal(ability.trigger.eventType, "card.placed", abilityId);
    assert.deepEqual(ability.trigger.circles, ["guardian"], abilityId);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1, ...(ability.costs[0].filter ? { filter: ability.costs[0].filter } : {}) }], abilityId);
    assert.equal(ability.effects.length, 1, abilityId);
    assert.equal(ability.effects[0].op, "protect-target", abilityId);
    assert.equal(ability.effects[0].duration, "battle", abilityId);
    assert.equal(ability.canDecline, /you may pay the cost/i.test(ability.printedText), abilityId);
  }
});

test("host and joining player resolve every Guardian Sentinel ability using their own matching hand card", () => {
  for (const { cardId } of BATCH) for (const ownerSide of ["human", "bot"]) {
    const f = fixture(cardId, ownerSide);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1, `${cardId}:${ownerSide}`);
    assert.equal(f.state.pendingAbility.side, ownerSide, `${cardId}:${ownerSide}`);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}:${ownerSide}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true, `${cardId}:${ownerSide}`);
    assert.deepEqual(f.state.players[ownerSide].drop.map(card => card.uid), [f.payment.uid], `${cardId}:${ownerSide}`);
    assert.deepEqual(f.state.players[ownerSide === "human" ? "bot" : "human"].hand, [], `${cardId}:${ownerSide}`);
  }
});

test("Guardian Sentinel activation rejects wrong source, circle, clan payment/target, or opponent decision without mutation", () => {
  const source = fixture("cfa-15");
  assert.equal(Reducer.discoverAutoTriggers(source.state, [{ ...source.event, sourceCardInstanceId: "other", subjectCardInstanceId: "other", cardInstanceId: "other" }], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(source.state, [{ ...source.event, currentLocation: "rear-left", circle: "rear-guard" }], Engine).queued.length, 0);

  const wrongPayment = fixture("cfa-15");
  Reducer.discoverAutoTriggers(wrongPayment.state, [wrongPayment.event], Engine);
  const wrongCard = cardById("cfa-2");
  wrongPayment.state.players.bot.hand = [instance(wrongCard, "wrong-clan-discard", "player-guest")];
  const beforePayment = JSON.stringify(wrongPayment.state);
  const paymentResult = resolve(wrongPayment, { discardUid: "wrong-clan-discard" });
  assert.equal(paymentResult.ok, false);
  assert.equal(JSON.stringify(wrongPayment.state), beforePayment);

  const wrongTarget = fixture("cfa-15");
  Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine);
  const foreign = instance(cardById("cfa-3"), "foreign-target", "player-host", { zone: "vanguard", circle: "vanguard" });
  wrongTarget.state.players.human.vanguard = foreign;
  const beforeTarget = JSON.stringify(wrongTarget.state);
  assert.equal(resolve(wrongTarget, { targetUid: foreign.uid }).ok, false);
  assert.equal(JSON.stringify(wrongTarget.state), beforeTarget);

  const wrongSeat = fixture("cfa-15");
  Reducer.discoverAutoTriggers(wrongSeat.state, [wrongSeat.event], Engine);
  const beforeSeat = JSON.stringify(wrongSeat.state);
  assert.equal(resolve(wrongSeat, { authUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(wrongSeat.state), beforeSeat);
});

test("optional Guardian Sentinel can decline without paying; mandatory variant requires its discard", () => {
  const optional = fixture("cfa-15");
  assert.equal(Reducer.discoverAutoTriggers(optional.state, [optional.event], Engine).queued.length, 1);
  assert.equal(resolve(optional, { accept: false }).ok, true);
  assert.equal(optional.state.players.bot.hand.length, 1);
  assert.equal(optional.state.players.bot.drop.length, 0);
  assert.equal(optional.state.pendingAttack.perfectGuard, undefined);

  const mandatory = fixture("cfa-8234");
  assert.equal(mandatory.ability.canDecline, false);
  assert.equal(Reducer.discoverAutoTriggers(mandatory.state, [mandatory.event], Engine).queued.length, 1);
  const before = JSON.stringify(mandatory.state);
  assert.equal(resolve(mandatory, { discardUid: null }).ok, false);
  assert.equal(JSON.stringify(mandatory.state), before);
});
