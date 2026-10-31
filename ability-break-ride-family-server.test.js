"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const BREAK_RIDES = ["cfa-1251", "cfa-1671", "cfa-1879", "cfa-1945", "cfa-1954"];
const cardDef = id => catalog.find(card => String(card.id) === String(id));
const namedCard = name => catalog.find(card => String(card.name).toLowerCase() === String(name).toLowerCase());
const clanUnit = (clan, { grade, excludeId } = {}) => catalog.find(card => String(card.id) !== String(excludeId) && card.clan === clan && /unit/i.test(String(card.type)) && (grade == null || Number(card.grade) === grade));
function instance(definition, uid, playerId, extra = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", grade: Number(definition.grade), clan: definition.clan, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}
function stateFor(side, matchId = "break-ride-test") {
  const host = player("host-player"), guest = player("guest-player");
  return { matchId, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], side, phase: 2, turn: 5, players: { human: host, bot: guest } };
}
function sideIds(side) {
  return side === "human" ? { actor: "host-player", auth: "auth-host", other: "bot" } : { actor: "guest-player", auth: "auth-guest", other: "human" };
}
function placeBreakRidePair(state, cardId, side) {
  const spec = Engine.getBreakRideSpec(cardId), { actor, other } = sideIds(side), own = state.players[side], foe = state.players[other];
  const oldSource = instance(cardDef(cardId), `old-${cardId}-${side}`, actor, { zone: "soul" });
  const riderDef = clanUnit(spec.clan, { excludeId: cardId });
  assert.ok(riderDef, `${spec.clan} has a catalog unit to ride`);
  const rider = instance(riderDef, `rider-${cardId}-${side}`, actor, { zone: "vanguard", circle: "vanguard" });
  own.soul.push(oldSource); own.vanguard = rider;
  own.damage = Array.from({ length: 4 }, (_, index) => instance(cardDef("cfa-3"), `damage-${cardId}-${side}-${index}`, actor, { zone: "damage", faceDown: false }));
  foe.vanguard = instance(cardDef("cfa-3"), `foe-vg-${cardId}-${side}`, foe.playerId, { zone: "vanguard", circle: "vanguard" });
  return { spec, own, foe, oldSource, rider, actor, other };
}
function rideEvent(state, pair, overrides = {}) {
  return Engine.createRideGameEvent(state, {
    rider: pair.rider, ridden: pair.oldSource, actingPlayerId: pair.actor,
    turnPlayerId: pair.actor, previousLocation: "vanguard", eventId: `ride-${pair.oldSource.uid}`,
    ...overrides
  });
}
function abilityDecision(state, side, actionId, selection, accept = true) {
  return Reducer.applyAbilityDecision(state, {
    actorAuthUid: sideIds(side).auth, actionId, expectedStateVersion: state.stateVersion,
    payload: { accept, selection }
  }, seats, Engine);
}
function grantTo(rider, parent, turn) {
  rider.temporaryGrantedAbilities = [{
    grantId: `grant-${parent.uid}`, parentCardId: parent.cardId,
    parentAbilityId: `${parent.cardId}:0`, parentInstanceId: parent.uid,
    riderInstanceId: rider.uid, controllerPlayerId: rider.controllerPlayerId, turnId: turn
  }];
  return Engine.createBreakRideGrantedAbility(rider.temporaryGrantedAbilities[0], rider, turn);
}

test("the five exact Limit Break ride abilities and every printed sibling compile from catalog text", () => {
  for (const id of BREAK_RIDES) {
    const card = cardDef(id), parsed = Engine.parseCardAbilities(card);
    assert.ok(card, `${id} catalog record`);
    assert.equal(parsed.length, 3, `${id} ability count`);
    for (let index = 0; index < parsed.length; index++) {
      assert.equal(parsed[index].id, `${id}:${index}`, `${id} ability order`);
      assert.ok(card.text.includes(parsed[index].definition?.printedText), `${id}:${index} exact printed text retained`);
      assert.equal(parsed[index].implementationStatus, "structured-effect-definition", `${id}:${index} structured ability`);
    }
    const breakRide = parsed[0];
    assert.equal(breakRide.definition.source.patternId, "auto-limit-break-clan-break-ride-grant-v1");
    assert.equal(breakRide.trigger.eventType, "card.ridden");
    assert.equal(breakRide.trigger.subject, "ridden-unit");
    assert.equal(Reducer.supportsServerAbilityEffects(breakRide), true, `${id} parent implementation`);
    const tampered = structuredClone(breakRide);
    tampered.definition.effects[0].amount = 5000;
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, `${id} altered parent effect rejected`);
  }
  const pacificaAct = Engine.parseCardAbilities(cardDef("cfa-1954"))[1];
  assert.equal(pacificaAct.kind, "ACT");
  assert.equal(pacificaAct.requiredLocation[0], "soul");
  assert.equal(Reducer.supportsServerAbilityEffects(pacificaAct), true);
});

test("the non-break-ride siblings keep their own AUTO, ACT, CONT, and Lord behavior", () => {
  for (const id of BREAK_RIDES) {
    const abilities = Engine.parseCardAbilities(cardDef(id));
    for (const ability of abilities.filter(candidate => candidate.kind !== "CONT")) {
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${ability.id} has a server implementation`);
    }
    for (const lord of abilities.filter(candidate => candidate.definition?.source?.patternId === "cont-lord-attack-restriction-v1")) {
      const source = cardDef(id), foreign = cardDef(id === "cfa-1671" ? "cfa-1251" : "cfa-1671");
      const denied = Engine.evaluateContinuousRestrictions([lord], { sourceInstanceId: "source", sourceCard: source, location: "vanguard", controlledUnits: [{ uid: "source", card: source }, { uid: "foreign", card: foreign }] });
      const allowed = Engine.evaluateContinuousRestrictions([lord], { sourceInstanceId: "source", sourceCard: source, location: "vanguard", controlledUnits: [{ uid: "source", card: source }, { uid: "same-clan", card: source }] });
      assert.equal(denied.legal, false, `${id} Lord rejects a cross-clan unit`);
      assert.equal(allowed.legal, true, `${id} Lord permits same-clan units`);
    }
  }
  const overlord = Engine.parseCardAbilities(cardDef("cfa-1945")).find(ability => ability.id === "cfa-1945:1");
  assert.equal(overlord.definition.source.patternId, "cont-vanguard-own-turn-rearguard-clan-count-power-v1");
  const fourBermuda = Array.from({ length: 4 }, (_, index) => ({ uid: `bt-${index}`, zone: "rear-guard", clans: ["Bermuda Triangle"] }));
  const continuousContext = { location: "vanguard", sourceInstanceId: "cfa-1945-vg", controllerFieldCards: fourBermuda };
  assert.equal(Engine.evaluateContinuousEffects([overlord], { ...continuousContext, isControllerTurn: true }).power, 2000);
  assert.equal(Engine.evaluateContinuousEffects([overlord], { ...continuousContext, controllerFieldCards: fourBermuda.slice(0, 3), isControllerTurn: true }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([overlord], { ...continuousContext, isControllerTurn: false }).power, 0);
});

test("each host or joining player's exact ridden instance receives the +10000 and an instance-only quoted ability", () => {
  for (const id of BREAK_RIDES) for (const side of ["human", "bot"]) {
    const state = stateFor(side, `parent-${id}-${side}`), pair = placeBreakRidePair(state, id, side), event = rideEvent(state, pair);
    const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(discovered.queued.length, 1, `${id} ${side}`);
    assert.equal(state.pendingAbility.side, side);
    assert.equal(state.pendingAbility.instance.uid, pair.oldSource.uid);
    const resolved = abilityDecision(state, side, `resolve-${id}-${side}`, { instanceUid: pair.oldSource.uid, abilityId: `${id}:0`, costSelections: { cb: [], sb: [], discard: [], reveal: [] } });
    assert.equal(resolved.ok, true, `${id} ${side}: ${resolved.reason}`);
    assert.equal(pair.rider.turnPowerBoost, 10000);
    assert.equal(pair.rider.temporaryGrantedAbilities.length, 1);
    assert.equal(pair.rider.temporaryGrantedAbilities[0].parentInstanceId, pair.oldSource.uid);
    assert.equal(pair.rider.temporaryGrantedAbilities[0].riderInstanceId, pair.rider.uid);
    const granted = Engine.createBreakRideGrantedAbility(pair.rider.temporaryGrantedAbilities[0], pair.rider, state.turn);
    assert.equal(granted.definition.printedText, pair.spec.abilityText);
    assert.equal(Reducer.supportsServerAbilityEffects(granted), true);
    const other = state.players[pair.other];
    assert.equal(other.vanguard.turnPowerBoost || 0, 0, "opponent's Vanguard is unchanged");
    assert.equal(Engine.createBreakRideGrantedAbility(pair.rider.temporaryGrantedAbilities[0], pair.rider, state.turn + 1), null, "grant expires at turn change");
  }
});

test("break ride prompts reject wrong clans, wrong ridden instances, wrong timing, and Limit Break below four damage", () => {
  const id = "cfa-1251";
  {
    const state = stateFor("human", "wrong-clan"), pair = placeBreakRidePair(state, id, "human"), wrong = clanUnit("Nova Grappler", { excludeId: id });
    pair.own.vanguard = instance(wrong, "wrong-clan-rider", pair.actor, { zone: "vanguard", circle: "vanguard" }); pair.rider = pair.own.vanguard;
    assert.equal(Reducer.discoverAutoTriggers(state, [rideEvent(state, pair)], Engine).queued.length, 0);
  }
  {
    const state = stateFor("human", "wrong-target"), pair = placeBreakRidePair(state, id, "human"), otherOld = instance(clanUnit("Kagero", { grade: 3, excludeId: id }), "different-old-instance", pair.actor, { zone: "soul" });
    pair.own.soul.push(otherOld);
    const event = Engine.createRideGameEvent(state, { rider: pair.rider, ridden: otherOld, actingPlayerId: pair.actor, turnPlayerId: pair.actor, previousLocation: "vanguard", eventId: "wrong-target-event" });
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 0);
  }
  {
    const state = stateFor("human", "limit-break"), pair = placeBreakRidePair(state, id, "human"); pair.own.damage.pop();
    assert.equal(Reducer.discoverAutoTriggers(state, [rideEvent(state, pair)], Engine).queued.length, 0);
  }
  {
    const state = stateFor("human", "wrong-timing"), pair = placeBreakRidePair(state, id, "human"); state.phase = 3;
    assert.equal(Reducer.discoverAutoTriggers(state, [rideEvent(state, pair)], Engine).queued.length, 0);
  }
});

test("Pacifica's Soul ACT is independently usable by both seats and rejects an illegal RC cost without partial changes", () => {
  const ability = Engine.parseCardAbilities(cardDef("cfa-1954"))[1], topIdol = namedCard("Top Idol, Pacifica"), otherBt = clanUnit("Bermuda Triangle", { excludeId: "cfa-1954" });
  assert.ok(topIdol); assert.ok(otherBt);
  for (const side of ["human", "bot"]) {
    const state = stateFor(side, `pacifica-act-${side}`), { actor, other } = sideIds(side), own = state.players[side], foe = state.players[other];
    const source = instance(cardDef("cfa-1954"), `pacifica-source-${side}`, actor, { zone: "soul" });
    const cost = instance(topIdol, `pacifica-cost-${side}`, actor, { zone: "rear-guard", circle: "rear-left" });
    const target = instance(otherBt, `pacifica-target-${side}`, actor, { zone: "rear-guard", circle: "rear-right" });
    const cb = instance(cardDef("cfa-3"), `pacifica-cb-${side}`, actor, { zone: "damage", faceDown: false });
    own.soul.push(source); own.rear[0] = cost; own.rear[1] = target; own.damage.push(cb); state.phase = 4;
    foe.vanguard = instance(cardDef("cfa-3"), `pacifica-foe-${side}`, foe.playerId, { zone: "vanguard", circle: "vanguard" });
    const result = Reducer.applyManualAbilityActivation(state, {
      actorAuthUid: sideIds(side).auth, actionId: `pacifica-activate-${side}`, expectedStateVersion: state.stateVersion,
      payload: { sourceCardInstanceId: source.uid, abilityId: ability.id, selection: { effectUid: cost.uid, targetUid: target.uid, costSelections: { cb: [cb.uid], sb: [], discard: [], reveal: [] } } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(own.damage[0].faceDown, true);
    assert.ok(own.soul.some(card => card.uid === cost.uid));
    assert.ok(own.hand.some(card => card.uid === source.uid));
    assert.ok(own.hand.some(card => card.uid === target.uid));
    const invalidState = stateFor(side, `pacifica-invalid-${side}`), invalidOwn = invalidState.players[side], invalidSource = instance(cardDef("cfa-1954"), `pacifica-invalid-source-${side}`, actor, { zone: "soul" });
    invalidOwn.soul.push(invalidSource); invalidOwn.rear[0] = instance(topIdol, `pacifica-invalid-cost-${side}`, actor, { zone: "rear-guard", circle: "rear-left" });
    invalidOwn.rear[1] = instance(otherBt, `pacifica-invalid-target-${side}`, actor, { zone: "rear-guard", circle: "rear-right" });
    invalidState.phase = 4;
    const before = JSON.stringify(invalidState);
    const invalid = Reducer.applyManualAbilityActivation(invalidState, {
      actorAuthUid: sideIds(side).auth, actionId: `pacifica-invalid-${side}`, expectedStateVersion: invalidState.stateVersion,
      payload: { sourceCardInstanceId: invalidSource.uid, abilityId: ability.id, selection: { effectUid: invalidOwn.rear[0].uid, targetUid: invalidOwn.rear[1].uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
    }, seats, Engine);
    assert.equal(invalid.ok, false);
    assert.equal(JSON.stringify(invalidState), before, "missing Counter Blast does not partially change the state");
  }
});

function childEvent(state, pair, childCardId) {
  const target = pair.foe.vanguard;
  if (childCardId === "cfa-1954") {
    const moved = instance(clanUnit("Bermuda Triangle"), `returned-${pair.rider.uid}`, pair.actor, { zone: "hand" });
    pair.own.hand.push(moved);
    return Engine.createGameEvent(state, {
      type: "card.moved", eventId: `return-${pair.rider.uid}`, actingPlayerId: pair.actor, turnPlayerId: pair.actor,
      sourceCardInstanceId: moved.uid, sourceOwnerPlayerId: pair.actor, sourceControllerPlayerId: pair.actor,
      cardInstanceId: moved.uid, subjectCardInstanceId: moved.uid, subjectOwnerPlayerId: pair.actor, subjectControllerPlayerId: pair.actor,
      previousLocation: "rear-guard", currentLocation: "hand", circle: "rear-left", phase: "main", timingWindow: "ability-resolution"
    });
  }
  const eventType = childCardId === "cfa-1251" || childCardId === "cfa-1879" ? "battle.close-step" : "unit.attacked";
  const targetLocation = childCardId === "cfa-1879" ? "rear-guard" : "vanguard";
  let targetUid = target.uid;
  if (targetLocation === "rear-guard") {
    const rear = instance(clanUnit("Kagero"), `opponent-rear-${pair.rider.uid}`, pair.foe.playerId, { zone: "rear-guard", circle: "rear-left" });
    pair.foe.rear[0] = rear; targetUid = rear.uid;
  }
  return Engine.createGameEvent(state, {
    type: eventType, eventId: `${eventType}-${pair.rider.uid}`, actingPlayerId: pair.actor, turnPlayerId: pair.actor,
    sourceCardInstanceId: pair.rider.uid, sourceOwnerPlayerId: pair.actor, sourceControllerPlayerId: pair.actor,
    cardInstanceId: pair.rider.uid, subjectCardInstanceId: pair.rider.uid, subjectOwnerPlayerId: pair.actor, subjectControllerPlayerId: pair.actor,
    currentLocation: "vanguard", circle: "vanguard", targetCardInstanceIds: [targetUid], targetLocation,
    battleId: `battle-${pair.rider.uid}`, attackingUnitInstanceId: pair.rider.uid,
    phase: "battle", timingWindow: eventType === "unit.attacked" ? "attack-declared" : "battle-close"
  });
}

test("all five granted AUTO effects resolve for the correct player, with costs, targets, and once-per-turn use enforced", () => {
  for (const [index, id] of BREAK_RIDES.entries()) {
    const side = index % 2 ? "bot" : "human", state = stateFor(side, `granted-effect-${id}-${side}`), pair = placeBreakRidePair(state, id, side);
    const granted = grantTo(pair.rider, pair.oldSource, state.turn);
    assert.ok(granted);
    if (id === "cfa-1251") {
      pair.rider.rested = true;
      pair.own.hand = Array.from({ length: 3 }, (_, i) => instance(cardDef("cfa-542"), `discard-${id}-${i}`, pair.actor, { zone: "hand" }));
    }
    if (id === "cfa-1671") {
      pair.own.damage = [instance(cardDef("cfa-3"), `cb-${id}`, pair.actor, { zone: "damage", faceDown: false })];
      pair.own.rear[0] = instance(clanUnit("Nova Grappler"), `nova-rested-${id}`, pair.actor, { zone: "rear-guard", circle: "rear-left", rested: true });
      pair.own.rear[1] = instance(clanUnit("Kagero"), `kagero-rested-${id}`, pair.actor, { zone: "rear-guard", circle: "rear-right", rested: true });
    }
    if (id === "cfa-1879") {
      pair.own.damage = [instance(cardDef("cfa-3"), `cb-${id}`, pair.actor, { zone: "damage", faceDown: false })];
      pair.own.hand = [instance(clanUnit("Kagero"), `discard-${id}`, pair.actor, { zone: "hand" })];
      pair.rider.rested = true;
    }
    if (id === "cfa-1945") {
      pair.own.damage = [instance(cardDef("cfa-3"), `cb-${id}`, pair.actor, { zone: "damage", faceDown: false })];
      pair.own.rear[0] = instance(clanUnit("Bermuda Triangle"), `return-bt-a-${id}`, pair.actor, { zone: "rear-guard", circle: "rear-left" });
      pair.own.rear[1] = instance(clanUnit("Bermuda Triangle"), `return-bt-b-${id}`, pair.actor, { zone: "rear-guard", circle: "rear-right" });
      pair.own.hand = [instance(clanUnit("Bermuda Triangle"), `call-bt-a-${id}`, pair.actor, { zone: "hand" }), instance(clanUnit("Bermuda Triangle"), `call-bt-b-${id}`, pair.actor, { zone: "hand" })];
    }
    if (id === "cfa-1954") {
      pair.own.deck = [instance(clanUnit("Bermuda Triangle"), `search-bt-${id}`, pair.actor, { zone: "deck" })];
    }
    const event = childEvent(state, pair, id), discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.ok(discovered.queued.some(item => item.instance.uid === pair.rider.uid && item.ability.id === granted.id), `${id} exact granted ability is queued`);
    assert.equal(state.pendingAbility.side, side, `${id} prompt belongs to its controller`);
    const selection = { instanceUid: pair.rider.uid, abilityId: granted.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } };
    const forgedBefore = JSON.stringify(state);
    const forgedWhilePending = abilityDecision(state, side === "human" ? "bot" : "human", `forged-pending-${id}-${side}`, selection);
    assert.equal(forgedWhilePending.ok, false, `${id} cannot be resolved by the opposing seat`);
    assert.equal(JSON.stringify(state), forgedBefore, `${id} forged response leaves the pending skill unchanged`);
    if (id === "cfa-1251") selection.costSelections.discard = pair.own.hand.map(card => card.uid);
    if (id === "cfa-1671") selection.costSelections.cb = [pair.own.damage[0].uid];
    if (id === "cfa-1879") { selection.costSelections.cb = [pair.own.damage[0].uid]; selection.costSelections.discard = [pair.own.hand[0].uid]; }
    if (id === "cfa-1945") {
      selection.costSelections.cb = [pair.own.damage[0].uid];
      selection.callCardUids = pair.own.hand.map(card => card.uid);
      selection.callZoneByUid = { [pair.own.hand[0].uid]: "rear-left", [pair.own.hand[1].uid]: "rear-right" };
    }
    if (id === "cfa-1954") { selection.effectUid = pair.own.deck[0].uid; selection.callZone = "rear-left"; }
    const result = abilityDecision(state, side, `resolve-granted-${id}-${side}`, selection);
    assert.equal(result.ok, true, `${id} ${side}: ${result.reason}`);
    if (id === "cfa-1251") {
      assert.equal(pair.rider.rested, false); assert.equal(pair.rider.stoodTurnKey, `${state.turn}:${pair.actor}`); assert.equal(pair.own.drop.length, 3);
    }
    if (id === "cfa-1671") {
      assert.equal(pair.own.rear[0].rested, false); assert.equal(pair.own.rear[1].rested, true); assert.equal(pair.own.damage[0].faceDown, true);
    }
    if (id === "cfa-1879") {
      assert.equal(pair.rider.rested, false); assert.equal(pair.own.damage[0].faceDown, true); assert.ok(pair.own.drop.some(card => card.uid === selection.costSelections.discard[0]));
      assert.ok(pair.own.usedAbilities?.length, "this ability is used for the turn after resolving");
    }
    if (id === "cfa-1945") {
      assert.equal(pair.own.rear[0].uid, selection.callCardUids[0]); assert.equal(pair.own.rear[1].uid, selection.callCardUids[1]);
      assert.ok(pair.own.hand.some(card => card.uid === `return-bt-a-${id}`)); assert.ok(pair.own.hand.some(card => card.uid === `return-bt-b-${id}`));
      assert.equal(pair.own.damage[0].faceDown, true);
    }
    if (id === "cfa-1954") {
      assert.equal(pair.own.rear[0].uid, selection.effectUid); assert.equal(pair.own.deck.length, 0);
      assert.ok(pair.own.usedAbilities?.length, "Pacifica's granted AUTO is once per turn");
    }
    const forged = abilityDecision(state, side === "human" ? "bot" : "human", `forged-granted-${id}-${side}`, { instanceUid: pair.rider.uid, abilityId: granted.id });
    assert.equal(forged.ok, false, `${id} cannot be resolved by the other player`);
  }
});

test("a different unit's attack cannot trigger a granted source-only attack ability", () => {
  const id = "cfa-1671", side = "human", state = stateFor(side, "wrong-granted-attacker"), pair = placeBreakRidePair(state, id, side);
  const granted = grantTo(pair.rider, pair.oldSource, state.turn);
  const otherAttacker = instance(clanUnit("Nova Grappler"), "unrelated-attacker", pair.actor, { zone: "rear-guard", circle: "rear-left" });
  pair.own.rear[0] = otherAttacker;
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", eventId: "unrelated-attack", actingPlayerId: pair.actor, turnPlayerId: pair.actor,
    sourceCardInstanceId: otherAttacker.uid, sourceOwnerPlayerId: pair.actor, sourceControllerPlayerId: pair.actor,
    cardInstanceId: otherAttacker.uid, subjectCardInstanceId: otherAttacker.uid, subjectOwnerPlayerId: pair.actor, subjectControllerPlayerId: pair.actor,
    currentLocation: "rear-left", targetCardInstanceIds: [pair.foe.vanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: otherAttacker.uid, battleId: "unrelated-battle"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.some(item => item.ability.id === granted.id && item.instance.uid === pair.rider.uid), false);
});
