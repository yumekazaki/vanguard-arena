"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-forerunner-same-clan-ride-call-source-v1";
Engine.registerAbilityDefinitions(require('./ability-contributions/batch-PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4.js'));
const catalog = loadCatalog().filter(card => ["cfa-4023","cfa-4101","cfa-4614","cfa-5080"].includes(card.id));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture({ card, ability, side, clan, riderClan = clan, unrelatedRideTarget = false }) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `forerunner-${card.id}-${side}`, cardId: card.id, type: card.type, grade: card.grade,
    clan, clans: [clan], ownerPlayerId: playerId, controllerPlayerId: playerId };
  const rider = { uid: `rider-${card.id}-${side}`, cardId: `test-rider-${card.id}`, type: "Unit", grade: 1,
    clan: riderClan, clans: [riderClan], ownerPlayerId: playerId, controllerPlayerId: playerId };
  const own = { playerId, vanguard: rider, rear: Array(5).fill(null), soul: [source], drop: [], hand: [], damage: [], deck: [], bind: [],
    guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], hand: [], damage: [], deck: [], bind: [],
    guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `forerunner-batch-${card.id}-${side}`, stateVersion: 1, eventSequence: 0, side, turn: 2, phase: 2,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: rider.ownerPlayerId, sourceControllerPlayerId: rider.controllerPlayerId,
    sourceCardClan: rider.clan, sourceCardClans: rider.clans, cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: rider.ownerPlayerId, subjectControllerPlayerId: rider.controllerPlayerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [unrelatedRideTarget ? `not-${source.uid}` : source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride" });
  return { state, own, source, rider, event, side, playerId };
}

function resolve(f, ability) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-${ability.id}-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, callZone: "rear-left" } } }, seats, Engine);
}

test("all 4 trusted Forerunner records preserve exact source identity, text, location, and same-clan condition", () => {
  assert.equal(family.length, 4);
  assert.equal(new Set(family.map(({ ability }) => ability.id)).size, 4);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    assert.ok(card.text.includes(ability.printedText), `${ability.id}: exact printed ability text`);
    assert.equal(ability.kind, "AUTO", ability.id);
    assert.equal(ability.trigger.eventType, "card.ridden", ability.id);
    assert.equal(ability.trigger.subject, "ridden-unit", ability.id);
    assert.deepEqual(ability.trigger.circles, ["vanguard"], ability.id);
    assert.match(ability.definition.source.review, /same clan rides this exact unit/i, ability.id);
    assert.equal(ability.definition.effects[0]?.op, "call-source-from-soul", ability.id);
  }
});

test("each assigned Forerunner resolves from its own Soul for both host and joining player", () => {
  let testedWithClan = 0, missingClan = 0;
  for (const { card, ability } of family) {
    const clan = card.clan || card.clans?.[0];
    if (!clan) {
      missingClan++;
      for (const side of ["human", "bot"]) {
        const f = fixture({ card, ability, side, clan: "", riderClan: "Megacolony" });
        assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${card.id}: fail closed on missing clan`);
      }
      continue;
    }
    testedWithClan++;
    for (const side of ["human", "bot"]) {
      const f = fixture({ card, ability, side, clan, riderClan: clan });
      const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(discovered.queued.length, 1, `${side} ${card.id}: exact same-clan Ride should queue`);
      assert.equal(f.state.pendingAbility.side, side, `${side} ${card.id}: only the skill controller owns the prompt`);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side} ${card.id}: exact Forerunner instance owns it`);
      const result = resolve(f, ability);
      assert.equal(result.ok, true, `${side} ${card.id}: ${result.reason}`);
      assert.equal(f.own.soul.some(instance => instance.uid === f.source.uid), false, `${side} ${card.id}: source leaves Soul`);
      assert.equal(f.own.rear[0]?.uid, f.source.uid, `${side} ${card.id}: exact source is called to selected circle`);
      assert.equal(f.state.players[side === "human" ? "bot" : "human"].rear.every(instance => !instance), true, `${side} ${card.id}: opponent board not modified`);
    }
  }
  assert.equal(testedWithClan, 4);
  assert.equal(missingClan, 0);
});

test("every Forerunner rejects a different clan, unrelated ride target, and duplicate event", () => {
  for (const { card, ability } of family) {
    const clan = card.clan || card.clans?.[0];
    if (!clan) continue;
    const otherClan = clan.toLowerCase() === "kagero" ? "Megacolony" : "Kagero";
    for (const side of ["human", "bot"]) {
      const wrongClan = fixture({ card, ability, side, clan, riderClan: otherClan });
      assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0, `${side} ${card.id}: different clan`);
      const wrongTarget = fixture({ card, ability, side, clan, riderClan: clan, unrelatedRideTarget: true });
      assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0, `${side} ${card.id}: unrelated ridden card`);
      const duplicate = fixture({ card, ability, side, clan, riderClan: clan });
      assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 1, `${side} ${card.id}: first event`);
      assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0, `${side} ${card.id}: duplicate event suppressed`);
    }
  }
});

test("assigned Forerunners reject wrong events, locations, actors, stale decisions and illegal call circles", () => {
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const clan = card.clan || card.clans[0];
    for (const [label, mutate] of [
      ["wrong event", f => { f.event = { ...f.event, type: "card.placed" }; }],
      ["source in drop", f => { f.own.drop.push(f.own.soul.pop()); }],
      ["wrong controller", f => { f.source.controllerPlayerId = f.state.players[side === "human" ? "bot" : "human"].playerId; }]
    ]) {
      const f = fixture({ card, ability, side, clan }); mutate(f);
      assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, label);
      assert.equal(f.own.rear.every(x => !x), true, label);
    }
    for (const [label, mutate] of [
      ["wrong actor", command => { command.actorAuthUid = side === "human" ? seats.guestAuthUid : seats.hostAuthUid; }],
      ["stale version", command => { command.expectedStateVersion = -1; }],
      ["wrong source", command => { command.payload.selection.instanceUid = "other-source"; }],
      ["illegal circle", command => { command.payload.selection.callZone = "vanguard"; }]
    ]) {
      const f = fixture({ card, ability, side, clan });
      assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
      const command = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
        actionId: "invalid", expectedStateVersion: f.state.stateVersion,
        payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, callZone: "rear-left" } } };
      mutate(command);
      const before = JSON.stringify(f.state);
      const result = Reducer.applyAbilityDecision(f.state, command, seats, Engine);
      assert.equal(result.ok, false, `${card.id} ${side} ${label}: ${result.reason}`);
      assert.equal(JSON.stringify(f.state), before, label);
    }
    const f = fixture({ card, ability, side, clan });
    Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    const declined = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: "decline", expectedStateVersion: f.state.stateVersion,
      payload: { accept: false, selection: { instanceUid: f.source.uid, abilityId: ability.id } } }, seats, Engine);
    assert.equal(declined.ok, true, declined.reason);
    assert.equal(f.own.soul[0].uid, f.source.uid);
    assert.equal(f.own.rear.every(x => !x), true);
  }
});
