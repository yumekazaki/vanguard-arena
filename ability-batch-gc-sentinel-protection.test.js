"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-gc-sentinel-protect-friendly-unit-v1";
const catalog = loadCatalog(process.cwd());
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardById = id => cards.get(String(id));

function matchingCard(filter = {}) {
  return catalog.find(card => /unit/i.test(String(card.type || ""))
    && (!filter.clan || (card.clans || [card.clan]).filter(Boolean).includes(filter.clan))
    && (!filter.race || (card.races || [card.race]).filter(Boolean).includes(filter.race)));
}

function instance(card, uid, playerId, extras = {}) {
  assert.ok(card, `catalog definition is available for ${uid}`);
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade),
    clan: card.clan, clans: card.clans, race: card.race, races: card.races,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extras };
}

function fixture(cardId, ownerSide) {
  const card = cardById(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} has the exact Guardian Sentinel ability`);
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const otherSide = ownerSide === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const costFilter = ability.costs[0].filter || {};
  const targetFilter = ability.effects[0].targetFilter || {};
  const paymentCard = matchingCard(costFilter) || (Object.keys(costFilter).length ? null : cardById("cfa-2"));
  const targetCard = matchingCard(targetFilter) || (Object.keys(targetFilter).length ? null : cardById("cfa-2"));
  const source = instance(card, `source-${cardId}-${ownerSide}`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance(paymentCard, `payment-${cardId}-${ownerSide}`, ownerId);
  const target = instance(targetCard, `target-${cardId}-${ownerSide}`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const ownVanguard = instance(cardById("cfa-3"), `own-vanguard-${ownerSide}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const enemyVanguard = instance(cardById("cfa-3"), `enemy-vanguard-${ownerSide}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? ownVanguard : enemyVanguard,
      rear: ownerSide === "human" ? [target] : [], hand: ownerSide === "human" ? [payment] : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "human" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? ownVanguard : enemyVanguard,
      rear: ownerSide === "bot" ? [target] : [], hand: ownerSide === "bot" ? [payment] : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "bot" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: `gc-sentinel-${cardId}-${ownerSide}`, stateVersion: 1, turn: 2,
    side: otherSide, phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId: `battle-${cardId}-${ownerSide}`, attackerSide: otherSide,
      attackerUid: enemyVanguard.uid, attackerZone: "vanguard", defenderSide: ownerSide,
      targetUid: target.uid, targetZone: "rear-left", guardCards: [], power: 18000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId,
    turnPlayerId: otherId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand",
    currentLocation: "guardian", circle: "guardian", timingWindow: "guard" });
  return { state, event, source, payment, target, ability, ownerSide };
}

function discover(f, events = [f.event]) { return Reducer.discoverAutoTriggers(f.state, events, Engine); }

function resolve(f, { authUid, targetUid = f.target.uid, discardUid = f.payment.uid } = {}) {
  const actorAuthUid = authUid || (f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid);
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid,
    actionId: `sentinel-decision-${f.source.uid}-${actorAuthUid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid,
        costSelections: { cb: [], sb: [], discard: discardUid ? [discardUid] : [], reveal: [] } } }
  }, seats, Engine);
}

test("all 28 Sentinel Guardian abilities preserve their printed text, individual source, clan filters, and cost semantics", () => {
  assert.equal(family.length, 28);
  assert.equal(new Set(family.map(({ ability }) => ability.id)).size, 28);
  for (const { card, ability } of family) {
    const parsed = Engine.parseCardAbilitiesCached(card);
    const paymentClan = ability.printedText.match(/choose a «([^»]+)» from your hand/i)?.[1];
    const targetClan = ability.printedText.match(/choose one of your «([^»]+)»/i)?.[1];
    assert.ok(card.text.includes(ability.printedText), `${ability.id}: printed wording retained`);
    assert.equal(ability.kind, "AUTO", ability.id);
    assert.equal(ability.trigger.eventType, "card.placed", ability.id);
    assert.deepEqual(ability.trigger.circles, ["guardian"], ability.id);
    assert.deepEqual(ability.requiredLocation, [], `${ability.id}: timing is encoded as a trigger circle, not a standing source restriction`);
    assert.equal(ability.costs[0].type, "discard", ability.id);
    assert.equal(ability.costs[0].count, 1, ability.id);
    assert.deepEqual(ability.costs[0].filter, paymentClan ? { clan: paymentClan } : undefined, `${ability.id}: exact printed cost filter`);
    assert.equal(ability.effects[0].op, "protect-target", ability.id);
    assert.deepEqual(ability.effects[0].targetFilter, { controller: "source-controller", cardType: "unit", ...(targetClan ? { clan: targetClan } : {}) }, `${ability.id}: exact printed target filter`);
    assert.equal(ability.effects[0].duration, "battle", ability.id);
    assert.equal(ability.canDecline, /you may pay the cost/i.test(ability.printedText), `${ability.id}: optional vs mandatory wording`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.ok(parsed.length >= 2, `${ability.id}: additional printed skill(s) remain separately reviewed`);
  }
});

test("wrong source instances, non-Guardian placements, and repeated events cannot create duplicate prompts", () => {
  for (const { card } of family) for (const ownerSide of ["human", "bot"]) {
    const wrongSource = fixture(card.id, ownerSide);
    assert.equal(discover(wrongSource, [{ ...wrongSource.event, sourceCardInstanceId: "other-copy", subjectCardInstanceId: "other-copy", cardInstanceId: "other-copy" }]).queued.length, 0, `${card.id}/${ownerSide}: exact source identity`);

    const wrongCircle = fixture(card.id, ownerSide);
    assert.equal(discover(wrongCircle, [{ ...wrongCircle.event, currentLocation: "rear-left", circle: "rear-guard" }]).queued.length, 0, `${card.id}/${ownerSide}: Guardian Circle only`);

    const wrongEvent = fixture(card.id, ownerSide);
    assert.equal(discover(wrongEvent, [{ ...wrongEvent.event, type: "card.moved" }]).queued.length, 0, `${card.id}/${ownerSide}: exact placement event only`);

    const duplicate = fixture(card.id, ownerSide);
    assert.equal(discover(duplicate).queued.length, 1, `${card.id}/${ownerSide}: first event creates one prompt`);
    assert.equal(discover(duplicate).queued.length, 0, `${card.id}/${ownerSide}: duplicate event does not re-prompt`);
  }
});

test("all 28 Sentinel skills bind their prompt, cost, and protection effect to the owning player", () => {
  for (const { card } of family) for (const ownerSide of ["human", "bot"]) {
    const f = fixture(card.id, ownerSide);
    assert.equal(discover(f).queued.length, 1, `${card.id}/${ownerSide}: eligible GC placement`);
    assert.equal(f.state.pendingAbility.side, ownerSide, `${card.id}/${ownerSide}: prompt belongs to card controller`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${card.id}/${ownerSide}: exact Sentinel owns prompt`);

    const wrongSeat = fixture(card.id, ownerSide);
    discover(wrongSeat);
    const before = JSON.stringify(wrongSeat.state);
    const opponentAuthUid = ownerSide === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(resolve(wrongSeat, { authUid: opponentAuthUid }).ok, false, `${card.id}/${ownerSide}: opponent cannot resolve cost or effect`);
    assert.equal(JSON.stringify(wrongSeat.state), before, `${card.id}/${ownerSide}: forged resolution is atomic`);

    const invalidTarget = fixture(card.id, ownerSide);
    discover(invalidTarget);
    const foreign = instance(cardById("cfa-3"), `foreign-target-${card.id}-${ownerSide}`, ownerSide === "human" ? "player-guest" : "player-host", { zone: "vanguard", circle: "vanguard" });
    const foreignSide = ownerSide === "human" ? "bot" : "human";
    invalidTarget.state.players[foreignSide].vanguard = foreign;
    const beforeTarget = JSON.stringify(invalidTarget.state);
    assert.equal(resolve(invalidTarget, { targetUid: foreign.uid }).ok, false, `${card.id}/${ownerSide}: foreign target is illegal`);
    assert.equal(JSON.stringify(invalidTarget.state), beforeTarget, `${card.id}/${ownerSide}: invalid target is atomic`);
  }
});
