"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-76D8A0B8-0022.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function definition(cardId) {
  const card = cards.get(String(cardId));
  assert.ok(card, `catalog contains ${cardId}`);
  return card;
}
function instance(cardId, uid, playerId, extra = {}) {
  const card = definition(cardId);
  return {
    uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade || 0),
    power: Number(card.power || 0), clan: card.clan || card.clans?.[0], clans: [...(card.clans || (card.clan ? [card.clan] : []))],
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}
function parsed(abilityId) {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(definition(cardId)).find(item => item.id === abilityId);
  assert.ok(ability, `catalog parses ${abilityId}`);
  return ability;
}
function userFor(side) { return side === "human" ? "host-player" : "guest-player"; }
function authFor(side) { return side === "human" ? seats.hostAuthUid : seats.guestAuthUid; }
function makePlayer(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}

function rideFixture(abilityId, side, { riderName = "Genesis Rider", riderClan = "Genesis", targetUid } = {}) {
  const sourceId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const sourceCard = definition(sourceId), sourcePlayerId = userFor(side), otherSide = side === "human" ? "bot" : "human";
  const source = instance(sourceId, `source-${abilityId}-${side}`, sourcePlayerId);
  const rider = {
    uid: `rider-${abilityId}-${side}`, cardId: "unlisted-rider", cardName: riderName, type: "Unit", grade: 1,
    clan: riderClan, clans: [riderClan], ownerPlayerId: sourcePlayerId, controllerPlayerId: sourcePlayerId
  };
  const own = makePlayer(sourcePlayerId), opponent = makePlayer(userFor(otherSide));
  own.vanguard = rider;
  own.soul = [source];
  opponent.vanguard = instance("cfa-3", `opponent-vg-${side}`, userFor(otherSide), { zone: "vanguard", circle: "vanguard" });
  const state = {
    matchId: `batch0022-ride-${abilityId}-${side}`, stateVersion: 1, turn: 2, side, phase: 2,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    sourceCardName: rider.cardName, sourceCardClan: rider.clan, sourceCardClans: rider.clans,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: sourcePlayerId, subjectControllerPlayerId: sourcePlayerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [targetUid || source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, source, rider, own, opponent, event, side, sourcePlayerId, sourceCard };
}
function resolveRide(fixture, abilityId) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: authFor(fixture.side), actionId: `resolve-${abilityId}-${fixture.side}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId, callZone: "rear-left" } }
  }, seats, Engine);
}

function guardFixture(side) {
  const ownerId = userFor(side), attackerSide = side === "human" ? "bot" : "human", attackerId = userFor(attackerSide);
  const source = instance("cfa-11489", `guard-source-${side}`, ownerId, { zone: "guardian", circle: "guardian" });
  const discard = instance("cfa-2", `discard-${side}`, ownerId, { zone: "hand" });
  const target = instance("cfa-3", `target-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const defender = makePlayer(ownerId), attacker = makePlayer(attackerId);
  defender.vanguard = target;
  defender.hand = [discard];
  defender.guardCircle = [source];
  attacker.vanguard = instance("cfa-3", `attacker-${side}`, attackerId, { zone: "vanguard", circle: "vanguard" });
  const state = {
    matchId: `batch0022-gc-${side}`, stateVersion: 1, turn: 2, side: attackerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingAttack: { battleId: `guard-battle-${side}`, attackerSide, attackerUid: attacker.vanguard.uid, attackerZone: "vanguard", defenderSide: side, targetUid: target.uid, targetZone: "vanguard", guardCards: [], power: 18000, targetPower: 13000, critical: 1 },
    players: side === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "guard-placement", battleId: state.pendingAttack.battleId
  });
  return { state, source, discard, target, side, ownerId, event };
}
function resolveGuard(fixture, { actorAuthUid = authFor(fixture.side), discardUid = fixture.discard.uid, targetUid = fixture.target.uid } = {}) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId: `gc-decision-${fixture.side}-${actorAuthUid}-${discardUid}-${targetUid}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: "cfa-11489:1", targetUid,
      costSelections: { cb: [], sb: [], discard: [discardUid], reveal: [] }
    } }
  }, seats, Engine);
}

function placementDrawDiscardFixture(side, { changedSourceUid = false, circle = "vanguard" } = {}) {
  const ownerId = userFor(side), otherSide = side === "human" ? "bot" : "human", opponentId = userFor(otherSide);
  const source = instance("cfa-11489", `draw-discard-source-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const held = instance("cfa-2", `held-${side}`, ownerId, { zone: "hand" });
  const drawn = instance("cfa-2", `drawn-${side}`, ownerId, { zone: "deck" });
  const own = makePlayer(ownerId), opponent = makePlayer(opponentId);
  own.vanguard = source; own.hand = [held]; own.deck = [drawn];
  opponent.vanguard = instance("cfa-3", `other-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = {
    matchId: `batch0022-place-${side}`, stateVersion: 1, turn: 2, side, phase: 2,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  const eventSource = changedSourceUid ? "another-copy" : source.uid;
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: eventSource, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: eventSource, subjectCardInstanceId: eventSource, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: circle, circle, phase: "main", timingWindow: "call"
  });
  return { state, source, held, drawn, own, opponent, event, side, ownerId };
}

test("all 44 assigned abilities are classified against the exact catalog text and production support", () => {
  const assignment = require("./ability-work-batches.json").batches.find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 44);
  assert.equal(new Set(audit.abilityIds).size, 44);
  assert.equal(new Set(audit.abilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size, 25);
  assert.deepEqual(audit.proposedDefinitions, []);
  assert.equal(audit.alreadySupportedAbilityIds.length, 5);
  assert.equal(audit.serverResolvedAbilityIds.length, 4);
  assert.equal(audit.keywordAbilityIds.length, 1);
  assert.equal(audit.unsupportedSiblings.length, 39);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blockers = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  for (const id of audit.abilityIds) {
    const ability = parsed(id);
    assert.equal(ability.cardId, id.slice(0, id.lastIndexOf(":")), id);
    assert.ok(ability.printedText.length > 10, id);
    if (supported.has(id)) {
      assert.ok(ability.definition, `${id} already has a compiled definition`);
      assert.equal(ability.definition.id, id);
      assert.equal(ability.definition.printedText, ability.printedText);
    } else {
      assert.equal(ability.definition, null, `${id} remains uncompiled`);
      assert.equal(blockers.get(id)?.catalogPrintedText, ability.printedText);
      assert.ok(blockers.get(id)?.blocker.length > 50, `${id} has a concrete blocker`);
    }
  }
  for (const id of audit.serverResolvedAbilityIds) assert.equal(Reducer.supportsServerAbilityEffects(parsed(id)), true, id);
  assert.equal(Engine.hasAbilityKeyword(definition("cfa-11489"), "sentinel"), true);
  assert.equal(Engine.isManuallyActivatable(parsed("cfa-11489:0")), false);
});

test("official Bushiroad card pages are recorded without treating catalog wording variants as verbatim text", () => {
  assert.equal(audit.officialChecks.length, 2);
  const artemis = audit.officialChecks.find(item => item.cardId === "cfa-1148");
  const tamayorihime = audit.officialChecks.find(item => item.cardId === "cfa-1149");
  assert.equal(artemis.cardNumber, "BT10/033EN");
  assert.equal(tamayorihime.cardNumber, "BT10/032EN");
  for (const check of [artemis, tamayorihime]) {
    assert.match(check.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
    assert.equal(check.status, "mechanics-confirmed-local-wording-variant");
    assert.equal(check.abilityIds.length, 2);
  }
  assert.equal(audit.unsupportedSiblings.find(item => item.abilityId === "cfa-1148:0").officialReference, undefined);
});

test("GC discard-and-protect AUTO resolves privately for either player and rejects proxy/cost/target errors", () => {
  for (const side of ["human", "bot"]) {
    const f = guardFixture(side);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.equal(resolveGuard(f, { actorAuthUid: authFor(side === "human" ? "bot" : "human") }).ok, false);
    const accepted = resolveGuard(f);
    assert.equal(accepted.ok, true, accepted.reason);
    assert.equal(f.state.pendingAttack.perfectGuard, true);
    assert.equal(f.state.pendingAttack.blocked, true);
    assert.deepEqual(f.state.players[side].drop.map(card => card.uid), [f.discard.uid]);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].drop.length, 0);
  }

  for (const badChoice of [
    { discardUid: "missing-discard" },
    { targetUid: "opponent-only-unit" }
  ]) {
    const f = guardFixture("bot");
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    const before = { players: structuredClone(f.state.players), pendingAttack: structuredClone(f.state.pendingAttack) };
    assert.equal(resolveGuard(f, badChoice).ok, false);
    assert.deepEqual(f.state.players, before.players, "invalid payment or target leaves card zones unchanged");
    assert.deepEqual(f.state.pendingAttack, before.pendingAttack, "invalid payment or target leaves battle effects unchanged");
  }
});

test("Vanguard placement draw-discard matches only this source on VC and resolves for both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = placementDrawDiscardFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: authFor(side), actionId: `place-draw-discard-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-11489:2", effectDiscardUid: f.drawn.uid } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.own.hand.map(card => card.uid), [f.held.uid]);
    assert.deepEqual(f.own.drop.map(card => card.uid), [f.drawn.uid]);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn", "card.discarded"]);
  }

  const unrelated = placementDrawDiscardFixture("bot", { changedSourceUid: true });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0);
  const wrongCircle = placementDrawDiscardFixture("bot", { circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);
});

test("Artemis optional ride call checks exact ridden source, rider name/clan, and controller on both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = rideFixture("cfa-1148:1", side);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolveRide(f, "cfa-1148:1");
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.rear[0].uid, f.source.uid);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), false);
    assert.equal(f.opponent.rear.some(card => card?.uid === f.source.uid), false);
  }
  for (const invalid of [
    { riderClan: "Kagero" },
    { riderName: "Bowstring of Heaven and Earth, Artemis" },
    { targetUid: "another-copy" }
  ]) {
    const f = rideFixture("cfa-1148:1", "bot", invalid);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, JSON.stringify(invalid));
  }
});

test("Tamayorihime Forerunner requires a same-clan ride and resolves to the source controller", () => {
  for (const side of ["human", "bot"]) {
    const f = rideFixture("cfa-1149:0", side);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolveRide(f, "cfa-1149:0");
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.rear[0].uid, f.source.uid);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), false);
  }
  const wrongClan = rideFixture("cfa-1149:0", "bot", { riderClan: "Kagero" });
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
  const unrelated = rideFixture("cfa-1149:0", "bot", { targetUid: "other-vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0);
});
