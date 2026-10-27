"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const Worker = require("./supabase/functions/match-worker/worker-core.js");

const MANUAL_CARD_ID = "cfa-19";
const MANUAL_ABILITY_ID = `${MANUAL_CARD_ID}:0`;

function claimedCommand(overrides = {}) {
  const ability = Engine.parseCardAbilities({ id: "engorge-card", text: "AUTO [VC/RC]: Engorge." })[0];
  const attacker = { uid: "attacker", cardId: "engorge-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const rear = { uid: "rear-target", cardId: "rear-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const state = {
    matchId: "match-1", stateVersion: 2, processedActionIds: [], authoritySeats: { hostSide: "human", guestSide: "bot" },
    players: {
      human: { playerId: "host-player", vanguard: null, deck: [], hand: [], damage: [], rear: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [] },
      bot: { playerId: "guest-player", vanguard: null, deck: [], hand: [], damage: [], rear: [attacker, rear], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [] }
    },
    pendingAttack: { attackerUid: attacker.uid, attackerSide: "bot" },
    pendingAbility: { side: "bot", instance: attacker, field: "rear-left", ability, triggerControllerPlayerId: "guest-player", eventContext: { event: "attack", eventId: "attack-event-1", gameEvent: { eventId: "attack-event-1", type: "unit.attacked", sourceCardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, sourceControllerPlayerId: "guest-player" } } }
  };
  return {
    ok: true, claimed: true, roomCode: "0123456789ABCDEF", actionId: "action-1", actorAuthUid: "auth-guest",
    expectedStateVersion: 2, payload: { type: "ability-response", accept: true, selection: { instanceUid: attacker.uid, abilityId: ability.id, engorgeTargetUids: [rear.uid] } },
    state, leaseToken: "lease-1", hostAuthUid: "auth-host", guestAuthUid: "auth-guest", ...overrides
  };
}

function rpcFor(claim, completeResult = { ok: true, accepted: true, stateVersion: 3 }) {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === "claim_match_action") return claim;
    if (name === "complete_match_action") return completeResult;
    throw new Error(`unexpected RPC ${name}`);
  };
  return { calls, rpc };
}

test("worker claims a leased command, reduces with DB actor identity, and commits the result", async () => {
  const claim = claimedCommand();
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.deepEqual(calls.map(call => call.name), ["claim_match_action", "complete_match_action"]);
  assert.equal(calls[0].args.p_room_code, "0123456789ABCDEF");
  assert.equal(calls[1].args.p_action_id, "action-1");
  assert.equal(calls[1].args.p_claim_token, "lease-1");
  assert.equal(calls[1].args.p_accepted, true);
  assert.equal(calls[1].args.p_next_state.players.bot.drop[0].uid, "rear-target");
  assert.equal(calls[1].args.p_result.events[0].type, "card.retired");
  assert.deepEqual(result, { processed: true, accepted: true, result: calls[1].args.p_result, stateVersion: 3 });
});

test("worker resolves an AUTO decision for the host-owned source without involving the joining player", async () => {
  const claim = claimedCommand();
  claim.actorAuthUid = "auth-host";
  const hostSource = claim.state.players.bot.rear[0];
  const hostTarget = claim.state.players.bot.rear[1];
  for (const card of [hostSource, hostTarget]) { card.ownerPlayerId = "host-player"; card.controllerPlayerId = "host-player"; }
  claim.state.players.bot.rear = [];
  claim.state.players.human.rear = [hostSource, hostTarget];
  claim.state.side = "human";
  claim.state.pendingAttack.attackerSide = "human";
  claim.state.pendingAbility.side = "human";
  claim.state.pendingAbility.triggerControllerPlayerId = "host-player";
  Object.assign(claim.state.pendingAbility.eventContext.gameEvent, {
    sourceOwnerPlayerId: "host-player", sourceControllerPlayerId: "host-player",
    subjectOwnerPlayerId: "host-player", subjectControllerPlayerId: "host-player"
  });
  claim.payload = { type: "ability-response", accept: true, selection: { instanceUid: hostSource.uid, abilityId: claim.state.pendingAbility.ability.id, engorgeTargetUids: [hostTarget.uid] } };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  assert.equal(calls[1].args.p_next_state.players.human.drop[0].uid, hostTarget.uid);
  assert.equal(calls[1].args.p_next_state.players.bot.drop.length, 0);
  assert.equal(calls[1].args.p_result.events[0].subjectControllerPlayerId, "host-player");
});

test("worker does not commit when there is no claim", async () => {
  const { calls, rpc } = rpcFor({ ok: true, claimed: false, reason: "command-leased" });
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.deepEqual(calls.map(call => call.name), ["claim_match_action"]);
  assert.deepEqual(result, { processed: false, reason: "command-leased" });
});

test("unknown commands and missing trusted seat mapping are rejected without committing state", async () => {
  for (const [claim, expectedReason] of [
    [claimedCommand({ payload: { type: "manual:stride" } }), "unsupported-command"],
    [claimedCommand({ state: { ...claimedCommand().state, authoritySeats: undefined } }), "canonical-seat-mapping-missing"]
  ]) {
    const { calls, rpc } = rpcFor(claim, { ok: true, accepted: false, stateVersion: 2 });
    const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
    assert.equal(result.accepted, false);
    assert.equal(result.result.reason, expectedReason);
    assert.equal(calls[1].args.p_next_state, null);
    assert.equal(calls[1].args.p_accepted, false);
  }
});

test("worker reports a failed lease commit rather than claiming success", async () => {
  const { rpc } = rpcFor(claimedCommand(), { ok: false, accepted: false });
  await assert.rejects(() => Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer }), /could not be committed/);
});

test("only an authenticated host or joining-player identity can invoke room command processing", () => {
  const room = { host_auth_uid: "auth-host", guest_auth_uid: "auth-guest" };
  assert.equal(Worker.isRoomSeatAuthUid("auth-host", room), true);
  assert.equal(Worker.isRoomSeatAuthUid("auth-guest", room), true);
  assert.equal(Worker.isRoomSeatAuthUid("auth-watcher", room), false);
  assert.equal(Worker.isRoomSeatAuthUid("auth-host", null), false);
  assert.equal(Worker.isRoomSeatAuthUid(null, room), false);
});

function initialSetupClaim() {
  const claim = claimedCommand();
  const state = claim.state;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingAttack = null; state.pendingTrigger = null;
  state.preMatch = { stage: "roll", rolls: { human: null, bot: null }, winner: null, firstSide: null, mulliganDone: { human: false, bot: false } };
  state.players.human.deck = Array.from({ length: 44 }, (_, i) => ({ uid: `host-deck-${i}`, cardId: `host-card-${i}`, ownerPlayerId: "host-player", controllerPlayerId: "host-player" }));
  state.players.bot.deck = Array.from({ length: 44 }, (_, i) => ({ uid: `guest-deck-${i}`, cardId: `guest-card-${i}`, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" }));
  state.players.human.hand = Array.from({ length: 5 }, (_, i) => ({ uid: `host-hand-${i}`, cardId: `host-card-hand-${i}`, ownerPlayerId: "host-player", controllerPlayerId: "host-player" }));
  state.players.bot.hand = Array.from({ length: 5 }, (_, i) => ({ uid: `guest-hand-${i}`, cardId: `guest-card-hand-${i}`, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" }));
  state.players.human.vanguard = { uid: "host-vanguard", cardId: "host-vg", grade: 0, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  state.players.bot.vanguard = { uid: "guest-vanguard", cardId: "guest-vg", grade: 0, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  return claim;
}

test("trusted setup accepts independent authenticated rolls and only the winner chooses the first player", () => {
  const claim = initialSetupClaim(), state = claim.state;
  const apply = (authUid, id, payload) => Reducer.applyGameAction(state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);
  let tries = 0;
  while (!state.preMatch.winner && tries++ < 50) {
    assert.equal(apply("auth-host", `host-roll-${tries}`, { action: "setupRoll" }).ok, true);
    if (state.preMatch.winner) break;
    assert.equal(apply("auth-guest", `guest-roll-${tries}`, { action: "setupRoll" }).ok, true);
  }
  assert.ok(state.preMatch.winner, "secure rolls should eventually break ties");
  const winner = state.preMatch.winner, winnerAuth = winner === "human" ? "auth-host" : "auth-guest";
  const loserAuth = winner === "human" ? "auth-guest" : "auth-host";
  assert.equal(apply(loserAuth, "wrong-side-choice", { action: "setupChoice", firstSide: "human" }).reason, "setup-choice-not-available");
  const choice = apply(winnerAuth, "winner-choice", { action: "setupChoice", firstSide: "bot" });
  assert.equal(choice.ok, true, choice.reason);
  assert.equal(state.preMatch.firstSide, "bot");
  assert.equal(state.preMatch.stage, "mulligan");
});

test("trusted setup validates and resolves each player's mulligan before starting the chosen turn", () => {
  const claim = initialSetupClaim(), state = claim.state;
  state.preMatch = { stage: "mulligan", rolls: { human: 6, bot: 2 }, winner: "human", firstSide: "bot", mulliganDone: { human: false, bot: false } };
  const apply = (authUid, id, payload) => Reducer.applyGameAction(state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);

  const before = JSON.stringify(state);
  assert.equal(apply("auth-host", "out-of-order-mulligan", { action: "setupMulligan", cardInstanceIds: [] }).reason, "first-player-mulligan-must-resolve-first");
  assert.equal(JSON.stringify(state), before);
  const guestFirst = apply("auth-guest", "guest-first-mulligan", { action: "setupMulligan", cardInstanceIds: ["guest-hand-0"] });
  assert.equal(guestFirst.ok, true, guestFirst.reason);
  assert.equal(state.preMatch.mulliganDone.bot, true);
  assert.ok(state.players.bot.hand.some(card => card.uid === "guest-deck-43"), "replacements are drawn from the deck top before shuffling");
  assert.equal(state.players.bot.hand.some(card => card.uid === "guest-hand-0"), false);
  assert.equal(apply("auth-host", "duplicate-mulligan-cards", { action: "setupMulligan", cardInstanceIds: ["host-hand-0", "host-hand-0"] }).reason, "invalid-mulligan-selection");
  assert.equal(apply("auth-host", "foreign-mulligan-card", { action: "setupMulligan", cardInstanceIds: ["guest-hand-0"] }).reason, "mulligan-card-not-in-own-hand");
  assert.equal(state.players.human.hand.length, 5);
  assert.equal(state.preMatch.mulliganDone.human, false);
  assert.ok(guestFirst.events.some(event => event.type === "card.moved" && event.currentLocation === "deck"));

  const host = apply("auth-host", "host-mulligan", { action: "setupMulligan", cardInstanceIds: ["host-hand-0", "host-hand-3"] });
  assert.equal(host.ok, true, host.reason);
  assert.equal(state.players.human.hand.length, 5);
  assert.equal(state.players.human.deck.length, 44);
  assert.equal(state.preMatch, null);
  assert.ok(state.players.human.hand.some(card => card.uid === "host-deck-43") && state.players.human.hand.some(card => card.uid === "host-deck-42"), "replacements are drawn before the returned cards are shuffled");
  assert.ok(host.events.some(event => event.type === "card.moved" && event.cardInstanceId === "host-hand-0"));
  assert.ok(host.events.some(event => event.type === "card.drawn" && event.timingWindow === "opening-hand-mulligan-draw"));
  assert.equal(state.side, "bot");
  assert.equal(state.firstSide, "bot");
  assert.equal(state.turn, 1);
  assert.ok(host.events.some(event => event.type === "turn.started" && event.turnPlayerId === "guest-player"));
  assert.equal(state.players.bot.hand.length, 5);
  assert.equal(state.players.bot.deck.length, 44);
});

test("opening mulligan keeps deck order when both players return zero cards", () => {
  const claim = initialSetupClaim(), state = claim.state;
  state.preMatch = { stage: "mulligan", rolls: { human: 4, bot: 2 }, winner: "human", firstSide: "human", mulliganDone: { human: false, bot: false } };
  const orders = { human: state.players.human.deck.map(card => card.uid), bot: state.players.bot.deck.map(card => card.uid) };
  const apply = (authUid, id) => Reducer.applyGameAction(state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "setupMulligan", cardInstanceIds: [] }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(apply("auth-host", "host-keeps",).ok, true);
  assert.deepEqual(state.players.human.deck.map(card => card.uid), orders.human);
  assert.equal(apply("auth-guest", "guest-keeps").ok, true);
  assert.deepEqual(state.players.bot.deck.map(card => card.uid), orders.bot);
});

test("canonical state validation rejects version drift, duplicate instances, and broken owner/controller references", () => {
  const claim = claimedCommand();
  const seats = Worker.seatMapping(claim);
  assert.deepEqual(Worker.validateCanonicalMatchState(claim.state, 2, seats), { ok: true, cardCount: 2 });

  const stale = claimedCommand();
  assert.equal(Worker.validateCanonicalMatchState(stale.state, 3, Worker.seatMapping(stale)).reason, "canonical-version-mismatch");

  const duplicate = claimedCommand();
  duplicate.state.players.human.rear = [{ ...duplicate.state.players.bot.rear[0] }];
  assert.equal(Worker.validateCanonicalMatchState(duplicate.state, 2, Worker.seatMapping(duplicate)).reason, "duplicate-card-instance-id");

  const invalidOwner = claimedCommand();
  invalidOwner.state.players.bot.rear[1].ownerPlayerId = "not-a-player";
  assert.equal(Worker.validateCanonicalMatchState(invalidOwner.state, 2, Worker.seatMapping(invalidOwner)).reason, "invalid-card-owner");

  const invalidController = claimedCommand();
  invalidController.state.players.bot.rear[1].controllerPlayerId = "not-a-player";
  assert.equal(Worker.validateCanonicalMatchState(invalidController.state, 2, Worker.seatMapping(invalidController)).reason, "invalid-card-controller");

  const invalidGrade = claimedCommand();
  invalidGrade.state.players.bot.rear[1].grade = 1.5;
  assert.equal(Worker.validateCanonicalMatchState(invalidGrade.state, 2, Worker.seatMapping(invalidGrade)).reason, "invalid-card-grade");

  const invalidLegionMate = claimedCommand();
  invalidLegionMate.state.players.bot.rear[0].legionMateInstanceId = invalidLegionMate.state.players.bot.rear[0].uid;
  assert.equal(Worker.validateCanonicalMatchState(invalidLegionMate.state, 2, Worker.seatMapping(invalidLegionMate)).reason, "invalid-legion-mate-instance");
});

test("worker rejects a malformed canonical state without passing it to the reducer", async () => {
  const claim = claimedCommand();
  claim.state.players.human.rear = [{ ...claim.state.players.bot.rear[0] }];
  const { calls, rpc } = rpcFor(claim, { ok: true, accepted: false, stateVersion: 2 });
  const reducer = { applyEngorgeDecision() { assert.fail("reducer must not run for a malformed canonical state"); } };
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer });
  assert.equal(result.accepted, false);
  assert.equal(result.result.reason, "duplicate-card-instance-id");
  assert.equal(calls[1].args.p_next_state, null);
});

test("worker resolves the joining player's normal Draw-phase draw into canonical state and emits a structured event", async () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 1; claim.state.turn = 2; claim.state.drewThisTurn = false;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const top = { uid: "turn-draw", cardId: "draw-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.deck.push(top);
  claim.payload = { type: "game-action", action: "draw" };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  const next = calls[1].args.p_next_state;
  assert.equal(next.players.bot.deck.some(card => card.uid === top.uid), false);
  assert.ok(next.players.bot.hand.some(card => card.uid === top.uid));
  assert.equal(next.drewThisTurn, true);
  assert.equal(next.stateVersion, 3);
  const event = calls[1].args.p_result.events[0];
  assert.equal(event.type, "card.drawn");
  assert.equal(event.subjectCardInstanceId, top.uid);
  assert.equal(event.previousLocation, "deck");
  assert.equal(event.currentLocation, "hand");
  assert.equal(event.actingPlayerId, "guest-player");
});

test("worker validates and resolves the joining player's normal ride with exact card and instance events", async () => {
  const riderCardId = "normal-ride-auto-fixture";
  const rideText = "AUTO: When rode upon, draw a card.";
  Engine.registerAbilityDefinitions([{
    id: `${riderCardId}:0`, cardId: riderCardId, kind: "AUTO", printedText: rideText,
    source: { review: "worker normal-ride regression fixture" }, effects: [{ op: "draw", count: 1 }]
  }]);
  const riddenUponCardId = "ridden-upon-auto-fixture";
  const riddenUponText = "AUTO [VC]: When another unit is placed on VC by riding this unit, draw a card.";
  Engine.registerAbilityDefinitions([{
    id: `${riddenUponCardId}:0`, cardId: riddenUponCardId, kind: "AUTO", printedText: riddenUponText,
    source: { review: "worker prior-Vanguard ride-target regression fixture" }, effects: [{ op: "draw", count: 1 }]
  }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 2; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const oldVanguard = { uid: "ride-old-vg", cardId: riddenUponCardId, grade: 0, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const rider = { uid: "ride-source", cardId: riderCardId, grade: 1, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.vanguard = oldVanguard;
  claim.state.players.bot.hand.push(rider);
  claim.state.players.bot.deck.push({ uid: "ride-draw", cardId: "ride-draw-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  claim.payload = { type: "game-action", action: "ride", cardInstanceId: rider.uid };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  const next = calls[1].args.p_next_state;
  assert.equal(next.ridePerformed, true);
  assert.equal(next.players.bot.vanguard.uid, rider.uid);
  assert.ok(next.players.bot.soul.some(card => card.uid === oldVanguard.uid));
  assert.ok(!next.players.bot.hand.some(card => card.uid === rider.uid));
  const [moved, ridden] = calls[1].args.p_result.events;
  assert.equal(moved.type, "card.moved");
  assert.equal(moved.subjectCardInstanceId, oldVanguard.uid);
  assert.equal(moved.previousLocation, "vanguard");
  assert.equal(moved.currentLocation, "soul");
  assert.equal(ridden.type, "card.ridden");
  assert.equal(ridden.sourceCardInstanceId, rider.uid);
  assert.equal(ridden.subjectCardInstanceId, rider.uid);
  assert.equal(ridden.previousLocation, "hand");
  assert.equal(ridden.currentLocation, "vanguard");
  assert.equal(calls[1].args.p_next_state.pendingAbility?.instance?.uid, rider.uid);
  assert.equal(calls[1].args.p_next_state.pendingAbility?.triggerControllerPlayerId, "guest-player");
  assert.equal(calls[1].args.p_next_state.pendingAbility?.eventContext?.gameEvent?.type, "card.ridden");
  assert.ok(calls[1].args.p_next_state.pendingAbilities.some(pending => pending.instance.uid === oldVanguard.uid), "the prior Vanguard's ride-target ability must also be queued");
  const priorVanguardPrompt = calls[1].args.p_next_state.pendingAbilities.find(pending => pending.instance.uid === oldVanguard.uid);
  assert.equal(priorVanguardPrompt.eventContext.gameEvent.targetCardInstanceIds[0], oldVanguard.uid);
});

test("worker calls the exact joining-player card to Rear-Guard Circle and triggers only that instance", async () => {
  const cardId = "normal-call-auto-fixture";
  const text = "AUTO [RC]: When this unit is placed on RC, draw a card.";
  Engine.registerAbilityDefinitions([{
    id: `${cardId}:0`, cardId, kind: "AUTO", printedText: text,
    source: { review: "worker normal-call regression fixture" }, effects: [{ op: "draw", count: 1 }]
  }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 4; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const called = { uid: "called-source", cardId, grade: 1, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const replacement = { uid: "replaced-unit", cardId: "old-rear", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const otherCopy = { uid: "other-copy", cardId, grade: 1, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.hand.push(called);
  claim.state.players.bot.rear[0] = otherCopy;
  claim.state.players.bot.rear[2] = replacement;
  claim.state.players.bot.deck.push({ uid: "call-draw", cardId: "draw-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  claim.payload = { type: "game-action", action: "call", cardInstanceId: called.uid, rearIndex: 2 };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  const next = calls[1].args.p_next_state;
  assert.equal(next.players.bot.rear[2].uid, called.uid);
  assert.ok(next.players.bot.drop.some(card => card.uid === replacement.uid));
  assert.ok(!next.players.bot.hand.some(card => card.uid === called.uid));
  assert.deepEqual(calls[1].args.p_result.events.map(event => event.type), ["card.retired", "card.placed"]);
  const placement = calls[1].args.p_result.events[1];
  assert.equal(placement.subjectCardInstanceId, called.uid);
  assert.equal(placement.previousLocation, "hand");
  assert.equal(placement.currentLocation, "rear-back-left");
  assert.equal(next.pendingAbility?.instance?.uid, called.uid);
  assert.equal(next.pendingAbility?.triggerControllerPlayerId, "guest-player");
  assert.ok(!next.pendingAbilities.some(pending => pending.instance.uid === otherCopy.uid));
});

test("reviewed booster AUTO buffs only its exact boosted Blaster Dark and rejects another target atomically", () => {
  const claim = claimedCommand(), state = claim.state;
  const booster = state.players.bot.rear[0], attacker = state.players.bot.rear[1];
  booster.cardId = "cfa-16"; booster.type = "Unit"; booster.cardName = "Knight of Elegant Skills, Gareth";
  booster.boostAbility = true; booster.power = 7000; booster.rested = false;
  attacker.cardName = "Blaster Dark"; attacker.type = "Unit"; attacker.unitCard = true;
  attacker.power = 10000; attacker.critical = 1; attacker.rested = false;
  state.players.bot.rear = [attacker, null, booster];
  state.players.human.vanguard = { uid: "host-vanguard", cardId: "host-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player", type: "Unit", power: 13000, critical: 1, grade: 3, unitCard: true };
  state.side = "bot"; state.phase = 5; state.turn = 2; state.firstTurnComplete = true; state.pendingAttack = null;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  const attack = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "boosted-attack", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: "host-vanguard", boosterCardInstanceId: booster.uid }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(attack.ok, true);
  const boostEvent = attack.events.find(event => event.type === "unit.boosted");
  const boosterAbility = Engine.parseCardAbilities({ id: booster.cardId, text: Engine.getReviewedAbilityDefinitionsForCard(booster.cardId)[0]?.printedText })[0];
  assert.equal(Engine.eventMatchesAbilityTrigger(boosterAbility, "boost", boostEvent, booster.uid, "rear-back-left", "rear-back-left", "guest-player"), true);
  assert.equal(state.pendingAbility?.instance.uid, booster.uid);
  assert.equal(state.pendingAbility?.eventContext.gameEvent.boostedCardInstanceId, attacker.uid, JSON.stringify(state.pendingAbility?.eventContext.gameEvent));
  const pending = state.pendingAbility, version = state.stateVersion;
  const wrong = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "wrong-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: booster.uid, abilityId: pending.ability.id, targetUid: "host-vanguard" } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "boosted-target-is-event-bound");
  assert.equal(state.players.bot.rear[0].turnPowerBoost || 0, 0);
  assert.equal(state.stateVersion, version);
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "right-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: booster.uid, abilityId: pending.ability.id } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true);
  assert.equal(state.players.bot.rear[0].turnPowerBoost, undefined);
  assert.equal(state.pendingAttack.power, 21000);
  const change = resolved.events.find(event => event.type === "characteristic.changed");
  assert.equal(change.subjectCardInstanceId, attacker.uid);
  assert.equal(change.sourceCardInstanceId, booster.uid);
  assert.deepEqual(change.before, { power: 17000 });
  assert.deepEqual(change.after, { power: 21000 });
});

test("joining player privately resolves its reviewed clan-conditioned own-attack hit AUTO", () => {
  const claim=claimedCommand(),state=claim.state;
  state.side="bot";state.turn=4;state.phase=5;state.eventSequence=0;state.pendingAttack=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;state.processedAbilityTriggers=[];
  const attacker={uid:"vaha-copy-a",cardId:"cfa-28",cardName:"Moonlight Witch, Vaha",type:"Unit",grade:2,unitCard:true,ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  const draw={uid:"guest-top-card",cardId:"draw-card",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  state.players.bot.vanguard={uid:"guest-vanguard",cardId:"shadow-vanguard",cardName:"Shadow Paladin Vanguard",clan:"Shadow Paladin",type:"Unit",grade:3,unitCard:true,ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  state.players.bot.rear=[attacker];state.players.bot.damage=[{uid:"damage-a",faceDown:false},{uid:"damage-b",faceDown:false}];state.players.bot.deck=[draw];
  state.players.human.vanguard={uid:"host-vanguard",cardId:"host-vg",type:"Unit",grade:3,unitCard:true,ownerPlayerId:"host-player",controllerPlayerId:"host-player"};
  const event=Engine.createGameEvent(state,{type:"attack.hit",actingPlayerId:"guest-player",turnPlayerId:"guest-player",sourceCardInstanceId:attacker.uid,sourceOwnerPlayerId:"guest-player",sourceControllerPlayerId:"guest-player",subjectCardInstanceId:attacker.uid,subjectOwnerPlayerId:"guest-player",subjectControllerPlayerId:"guest-player",targetLocation:"vanguard",battleId:"vaha-battle"});
  const discovered=Reducer.discoverAutoTriggers(state,[event],Engine);
  assert.equal(discovered.queued.length,1);
  assert.equal(state.pendingAbility.side,"bot");
  assert.equal(state.pendingAbility.instance.uid,attacker.uid);
  assert.equal(state.pendingAbility.ability.id,"cfa-28:0");
  assert.equal(state.pendingAbility.triggerControllerPlayerId,"guest-player");
  const decision=(actorAuthUid,actionId)=>Reducer.applyAbilityDecision(state,{actorAuthUid,actionId,expectedStateVersion:state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:attacker.uid,abilityId:"cfa-28:0",costSelections:{cb:["damage-a","damage-b"]}}}},Worker.seatMapping(claim),Engine);
  assert.equal(decision("auth-host","host-cannot-use-guest-auto").ok,false);
  assert.equal(state.players.bot.damage.every(card=>card.faceDown!==true),true);
  const resolved=decision("auth-guest","guest-resolves-own-auto");
  assert.equal(resolved.ok,true,resolved.reason);
  assert.equal(state.players.bot.hand.some(card=>card.uid===draw.uid),true);
  assert.equal(state.players.bot.damage.every(card=>card.faceDown===true),true);
  assert.equal(state.players.human.hand.some(card=>card.uid===draw.uid),false);
  assert.equal(state.pendingAbility,null);
});

test("joining player's optional clan-conditioned placement AUTO Soul Charges its own deck",()=>{
  const claim=claimedCommand(),state=claim.state;
  state.side="bot";state.turn=5;state.phase=5;state.eventSequence=0;state.pendingAttack=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;state.processedAbilityTriggers=[];
  const source={uid:"mosquito-copy",cardId:"cfa-53",cardName:"Machining Mosquito",type:"Unit",grade:1,unitCard:true,ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  const top={uid:"guest-soul-charge-top",cardId:"soul-card",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  state.players.bot.vanguard={uid:"guest-vanguard",cardId:"megacolony-vanguard",cardName:"Megacolony Vanguard",clan:"Megacolony",type:"Unit",grade:3,unitCard:true,ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
  state.players.bot.rear=[source];state.players.bot.deck=[top];
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:"guest-player",turnPlayerId:"guest-player",sourceCardInstanceId:source.uid,sourceOwnerPlayerId:"guest-player",sourceControllerPlayerId:"guest-player",subjectCardInstanceId:source.uid,subjectOwnerPlayerId:"guest-player",subjectControllerPlayerId:"guest-player",previousLocation:"hand",currentLocation:"rear-left"});
  assert.equal(Reducer.discoverAutoTriggers(state,[event],Engine).queued.length,1);
  assert.equal(state.pendingAbility.side,"bot");
  const resolved=Reducer.applyAbilityDecision(state,{actorAuthUid:"auth-guest",actionId:"guest-soul-charge",expectedStateVersion:state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:source.uid,abilityId:"cfa-53:0"}}},Worker.seatMapping(claim),Engine);
  assert.equal(resolved.ok,true,resolved.reason);
  assert.ok(state.players.bot.soul.some(card=>card.uid===top.uid));
  assert.equal(state.players.human.soul.some(card=>card.uid===top.uid),false);
});

test("reviewed cfa-453 placement AUTO checks its Counter-Blast and exact opposing grade-limited target", () => {
  const claim = claimedCommand(), state = claim.state;
  const source = { uid: "retire-source", cardId: "cfa-453", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Dark Irregulars Unit", type: "Unit", grade: 2, unitCard: true };
  const legalTarget = { uid: "opponent-grade-one", cardId: "grade-one", ownerPlayerId: "host-player", controllerPlayerId: "host-player", cardName: "Grade One Unit", type: "Unit", grade: 1 };
  const illegalTarget = { uid: "opponent-grade-two", cardId: "grade-two", ownerPlayerId: "host-player", controllerPlayerId: "host-player", cardName: "Grade Two Unit", type: "Unit", grade: 2 };
  state.turn = 3; state.side = "bot"; state.phase = 4; state.pendingAttack = null;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.vanguard = { uid: "guest-vanguard", cardId: "guest-vg", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Dark Irregulars Vanguard", clan: "Dark Irregulars", type: "Unit", grade: 3, power: 13000, critical: 1, unitCard: true };
  state.players.bot.hand.push(source);
  state.players.bot.rear = Array(5).fill(null);
  state.players.bot.damage = [
    { uid: "cb-one", cardId: "damage-one", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", faceDown: false },
    { uid: "cb-two", cardId: "damage-two", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", faceDown: false }
  ];
  state.players.human.rear = [legalTarget, illegalTarget];
  const call = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "place-retire-source", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "call", cardInstanceId: source.uid, rearIndex: 2 }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(call.ok, true, JSON.stringify(call));
  assert.equal(state.pendingAbility?.instance.uid, source.uid);
  assert.equal(state.pendingAbility?.ability.id, "cfa-453:0");
  const pending = state.pendingAbility, version = state.stateVersion;
  const invalid = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "wrong-grade-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: pending.ability.id, targetUid: illegalTarget.uid, costSelections: { cb: ["cb-one", "cb-two"] } } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, "ability-target-filter-not-met");
  assert.ok(state.players.bot.damage.every(card => card.faceDown === false));
  assert.equal(state.players.human.rear[0].uid, legalTarget.uid);
  assert.equal(state.stateVersion, version);
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "legal-grade-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: pending.ability.id, targetUid: legalTarget.uid, costSelections: { cb: ["cb-one", "cb-two"] } } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true);
  assert.ok(state.players.bot.damage.every(card => card.faceDown === true));
  assert.equal(state.players.human.rear[0], null);
  assert.equal(state.players.human.rear[1].uid, illegalTarget.uid);
  assert.equal(state.players.human.drop[0].uid, legalTarget.uid);
  const retired = resolved.events.find(event => event.type === "card.retired");
  assert.equal(retired.sourceCardInstanceId, source.uid);
  assert.equal(retired.subjectCardInstanceId, legalTarget.uid);
  assert.equal(retired.subjectControllerPlayerId, "host-player");
});

test("reviewed Revelation resolves its private Soul choice and rests only the joining player's selected rear-guard", () => {
  const claim = claimedCommand(), state = claim.state;
  const { loadCatalog } = require("./scripts/audit-ability-catalog");
  const catalogCard = loadCatalog().find(card => card.id === "cfa-4033");
  assert.ok(catalogCard);
  Engine.registerAbilityDefinitions(Engine.parseCardAbilities(catalogCard).map(ability => ability.definition).filter(Boolean));
  const source = { uid: "revelation-source", cardId: "cfa-4033", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Revelation Unit", type: "Unit", grade: 2, unitCard: true };
  const rear = { uid: "guest-rear", cardId: "rear-unit", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", type: "Unit", grade: 1, rested: false };
  const opponentRear = { uid: "host-rear", cardId: "opponent-rear", ownerPlayerId: "host-player", controllerPlayerId: "host-player", type: "Unit", grade: 1, rested: false };
  const top = { uid: "revelation-top", cardId: "top-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  state.turn = 3; state.side = "bot"; state.phase = 4; state.pendingAttack = null;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.hand.push(source);
  state.players.bot.rear = [rear, null, null, null, null];
  state.players.bot.deck = [top];
  state.players.bot.soul = [];
  state.players.human.rear = [opponentRear];
  const call = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "place-revelation-source", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "call", cardInstanceId: source.uid, rearIndex: 2 }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(call.ok, true, JSON.stringify(call));
  const pending = state.pendingAbility;
  assert.equal(pending?.instance?.uid, source.uid, JSON.stringify({ pending: state.pendingAbility, abilities: Engine.getReviewedAbilityDefinitionsForCard(source.cardId), events: call.events }));
  assert.equal(pending?.ability?.definition?.effects?.[1]?.op, "rest-target");
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "resolve-revelation", expectedStateVersion: state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: source.uid, abilityId: pending.ability.id, effectChoice: "soul",
      revelationTopUid: top.uid, targetUid: rear.uid
    } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.deepEqual(state.players.bot.deck, []);
  assert.equal(state.players.bot.soul[0].uid, top.uid);
  assert.equal(state.players.bot.rear[0].rested, true);
  assert.equal(state.players.human.rear[0].rested, false);
  const restEvent = resolved.events.find(event => event.type === "unit.rested");
  assert.equal(restEvent.subjectCardInstanceId, rear.uid);
  assert.equal(restEvent.subjectControllerPlayerId, "guest-player");
});

test("reviewed cfa-41 AUTO stands only its exact eligible friendly Machining Rear-Guard", () => {
  const claim = claimedCommand(), state = claim.state;
  const sourceDefinition = Engine.getReviewedAbilityDefinitionsForCard("cfa-41")[0];
  assert.ok(sourceDefinition);
  const source = { uid: "machining-ant-source", cardId: "cfa-41", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Machining Worker Ant", clan: "Megacolony", type: "Unit", grade: 1, unitCard: true };
  const target = { uid: "machining-rested-target", cardId: "machining-target", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Machining Stag Beetle", clan: "Megacolony", type: "Unit", grade: 2, unitCard: true, rested: true };
  const wrongTarget = { uid: "opponent-machining-target", cardId: "machining-opponent", ownerPlayerId: "host-player", controllerPlayerId: "host-player", cardName: "Machining Stag Beetle", clan: "Megacolony", type: "Unit", grade: 2, unitCard: true, rested: true };
  state.side = "bot"; state.phase = 4; state.turn = 3; state.pendingAttack = null;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.hand.push(source);
  state.players.bot.rear = [target, null, null, null, null];
  state.players.human.rear = [wrongTarget];
  const call = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "place-machining-ant", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "call", cardInstanceId: source.uid, rearIndex: 2 }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(call.ok, true, JSON.stringify(call));
  const pending = state.pendingAbility;
  assert.equal(pending?.instance?.uid, source.uid);
  assert.equal(pending?.ability?.id, "cfa-41:0");
  const version = state.stateVersion;
  const wrong = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "stand-wrong-player-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: pending.ability.id, targetUid: wrongTarget.uid } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "ability-target-filter-not-met");
  assert.equal(state.players.human.rear[0].rested, true);
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "stand-exact-friendly-target", expectedStateVersion: version,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: pending.ability.id, targetUid: target.uid } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(state.players.bot.rear[0].rested, false);
  assert.equal(state.players.human.rear[0].rested, true);
  const stood = resolved.events.find(event => event.type === "unit.stood");
  assert.equal(stood.subjectCardInstanceId, target.uid);
  assert.equal(stood.subjectControllerPlayerId, "guest-player");
});

test("reviewed no-op stand AUTO is silently consumed when no legal rested target exists", () => {
  const claim = claimedCommand(), state = claim.state;
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard("cfa-41").length);
  const source = { uid: "machining-ant-no-target", cardId: "cfa-41", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Machining Worker Ant", clan: "Megacolony", type: "Unit", grade: 1, unitCard: true };
  const standing = { uid: "machining-standing-target", cardId: "machining-target", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", cardName: "Machining Stag Beetle", clan: "Megacolony", type: "Unit", grade: 2, unitCard: true, rested: false };
  state.side = "bot"; state.phase = 4; state.turn = 3; state.pendingAttack = null;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.hand.push(source); state.players.bot.rear = [standing, null, null, null, null];
  const call = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "place-machining-ant-no-target", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "call", cardInstanceId: source.uid, rearIndex: 2 }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(call.ok, true, JSON.stringify(call));
  assert.equal(state.pendingAbility, null);
  assert.equal(state.pendingAbilities.length, 0);
  assert.ok(state.processedAbilityTriggers.some(key => key.includes(`${source.uid}:cfa-41:0`)));
});

test("trusted Stride rejects insufficient payment atomically, then strides for the joining player with legal cost", () => {
  const claim = claimedCommand(), state = claim.state;
  const oldVanguard = { uid: "stride-heart", cardId: "grade-three-vanguard", cardName: "Vanguard Name", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", type: "Unit", grade: 3, unitCard: true, rested: true };
  const stride = { uid: "stride-unit", cardId: "g-unit", cardName: "Test G Unit", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", type: "G Unit", grade: 4, gDeckCard: true, faceUp: false };
  const gradeTwo = { uid: "stride-cost-two", cardId: "grade-two", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 2, cardName: "Grade Two" };
  const gradeOne = { uid: "stride-cost-one", cardId: "grade-one", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 1, cardName: "Grade One" };
  state.side = "bot"; state.phase = 3; state.turn = 4; state.stridePerformed = false;
  state.turnStartGrades = { human: 2, bot: 3 };
  state.pendingAttack = null; state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.vanguard = oldVanguard;
  state.players.human.vanguard = { uid: "host-vg", cardId: "host-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player", grade: 2, type: "Unit", unitCard: true };
  state.players.bot.gDeck = [stride]; state.players.bot.hand = [gradeTwo];
  const rejected = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "stride-underpaid", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "stride", strideCardInstanceId: stride.uid, costCardInstanceIds: [gradeTwo.uid] }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "stride-cost-grade-insufficient");
  assert.equal(state.players.bot.vanguard.uid, oldVanguard.uid);
  assert.deepEqual(state.players.bot.gDeck.map(card => card.uid), [stride.uid]);
  assert.deepEqual(state.players.bot.hand.map(card => card.uid), [gradeTwo.uid]);
  assert.equal(state.stateVersion, 2);

  state.players.bot.hand.push(gradeOne);
  const resolved = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "stride-paid", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "stride", strideCardInstanceId: stride.uid, costCardInstanceIds: [gradeTwo.uid, gradeOne.uid] }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(state.players.bot.vanguard.uid, stride.uid);
  assert.equal(state.players.bot.vanguard.rested, true);
  assert.equal(state.players.bot.vanguard.strideHeart.uid, oldVanguard.uid);
  assert.deepEqual(state.players.bot.gDeck, []);
  assert.deepEqual(state.players.bot.drop.map(card => card.uid), [gradeTwo.uid, gradeOne.uid]);
  assert.equal(state.stridePerformed, true);
  assert.deepEqual(resolved.events.map(event => event.type), ["card.discarded", "card.discarded", "card.placed"]);
  const placement = resolved.events.at(-1);
  assert.equal(placement.subjectCardInstanceId, stride.uid);
  assert.equal(placement.currentLocation, "vanguard");
});

test("trusted Stride resolves a nonzero-index reviewed Hand grade modifier for the joining player",()=>{
  const claim=claimedCommand(),state=claim.state;
  const heart={uid:"stride-index-heart",cardId:"grade-three-vanguard",cardName:"Vanguard Name",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",type:"Unit",grade:3,unitCard:true,rested:true};
  const stride={uid:"stride-index-unit",cardId:"g-unit",cardName:"Test G Unit",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",type:"G Unit",grade:4,gDeckCard:true,faceUp:false};
  const steamBreath={uid:"steam-breath-cost",cardId:"cfa-2471",cardName:"Steam Breath Dragon",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",type:"Unit",grade:1};
  state.side="bot";state.phase=3;state.turn=5;state.stridePerformed=false;state.turnStartGrades={human:2,bot:3};
  state.pendingAttack=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
  state.players.bot.vanguard=heart;state.players.bot.gDeck=[stride];state.players.bot.hand=[steamBreath];
  state.players.human.vanguard={uid:"index-host-vg",cardId:"host-vg",ownerPlayerId:"host-player",controllerPlayerId:"host-player",grade:2,type:"Unit",unitCard:true};
  const result=Reducer.applyGameAction(state,{actorAuthUid:"auth-guest",actionId:"stride-nonzero-index-modifier",expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"stride",strideCardInstanceId:stride.uid,costCardInstanceIds:[steamBreath.uid]}},Worker.seatMapping(claim),Engine);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(state.players.bot.vanguard.uid,stride.uid);assert.equal(state.players.bot.drop[0].uid,steamBreath.uid);
});

test("trusted Ultimate Stride requires one exact card sharing a name with the Vanguard or its heart", () => {
  const claim = claimedCommand(), state = claim.state;
  const heart = { uid: "ultimate-heart", cardId: "heart", cardName: "Heart Name", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 3, type: "Unit", unitCard: true };
  const stride = { uid: "ultimate-stride", cardId: "ultimate-g-unit", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 4, gDeckCard: true, faceUp: false, ultimateStride: true };
  const wrong = { uid: "wrong-name", cardId: "wrong-card", cardName: "Different Name", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 3 };
  const correct = { uid: "right-name", cardId: "right-card", cardName: "Heart Name", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 0 };
  state.side = "bot"; state.phase = 3; state.turnStartGrades = { bot: 3, human: 2 };
  state.pendingAttack = null; state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.vanguard = heart; state.players.bot.gDeck = [stride]; state.players.bot.hand = [wrong];
  const rejected = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "ultimate-stride-wrong-name", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "stride", strideCardInstanceId: stride.uid, costCardInstanceIds: [wrong.uid] }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ultimate-stride-cost-not-met");
  assert.equal(state.players.bot.hand[0].uid, wrong.uid);
  assert.equal(state.players.bot.vanguard.uid, heart.uid);
  state.players.bot.hand = [correct];
  const resolved = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "ultimate-stride-right-name", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "stride", strideCardInstanceId: stride.uid, costCardInstanceIds: [correct.uid] }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(state.players.bot.vanguard.uid, stride.uid);
  assert.equal(state.players.bot.drop[0].uid, correct.uid);
});

test("trusted Ultimate Stride recognizes a printed CONT card-name alias from the server definitions",()=>{
  const claim=claimedCommand(),state=claim.state;
  const vanguard={uid:"alias-vanguard",cardId:"cfa-14003",cardName:"Shining Wing Star Dragon, Vyrgilla",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",grade:3,type:"Unit",unitCard:true};
  const stride={uid:"alias-ultimate-stride",cardId:"alias-g-unit",cardName:"Alias G Unit",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",grade:4,type:"G Unit",gDeckCard:true,faceUp:false,ultimateStride:true};
  const cost={uid:"alias-stride-cost",cardId:"cfa-694",cardName:"Soul Saver Dragon",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",grade:0,type:"Unit"};
  state.side="bot";state.phase=3;state.turnStartGrades={bot:3,human:2};state.pendingAttack=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
  state.players.bot.vanguard=vanguard;state.players.bot.gDeck=[stride];state.players.bot.hand=[cost];
  const result=Reducer.applyGameAction(state,{actorAuthUid:"auth-guest",actionId:"alias-ultimate-stride",expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"stride",strideCardInstanceId:stride.uid,costCardInstanceIds:[cost.uid]}},Worker.seatMapping(claim),Engine);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(state.players.bot.vanguard.uid,stride.uid);
  assert.equal(state.players.bot.drop[0].uid,cost.uid);
});

test("match worker commits an authenticated joining-player Stride to canonical state", async () => {
  const claim = claimedCommand(), state = claim.state;
  state.side = "bot"; state.phase = 3; state.turn = 5; state.turnStartGrades = { human: 2, bot: 3 };
  state.pendingAttack = null; state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.bot.vanguard = { uid: "worker-stride-heart", cardId: "heart", cardName: "Heart", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", type: "Unit", grade: 3, unitCard: true };
  state.players.human.vanguard = { uid: "worker-host-vg", cardId: "host-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player", type: "Unit", grade: 2, unitCard: true };
  const stride = { uid: "worker-stride-unit", cardId: "worker-g-unit", cardName: "Worker G Unit", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", type: "G Unit", grade: 4, gDeckCard: true, faceUp: false };
  const cost = { uid: "worker-stride-cost", cardId: "worker-cost", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 3 };
  state.players.bot.gDeck = [stride]; state.players.bot.hand = [cost];
  claim.payload = { type: "game-action", action: "stride", strideCardInstanceId: stride.uid, costCardInstanceIds: [cost.uid] };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true, JSON.stringify(result));
  const canonical = calls[1].args.p_next_state;
  assert.equal(canonical.players.bot.vanguard.uid, stride.uid);
  assert.equal(canonical.players.bot.vanguard.strideHeart.uid, "worker-stride-heart");
  assert.equal(canonical.players.bot.drop[0].uid, cost.uid);
  assert.equal(canonical.stridePerformed, true);
});

test("normal call rejects wrong phase, non-units, locked circles, and opponent-owned cards without mutation", () => {
  const setup = () => {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 4; claim.state.turn = 2;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.state.players.bot.hand.push({ uid: "call-card", cardId: "unit", grade: 1, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
    claim.payload = { type: "game-action", action: "call", cardInstanceId: "call-card", rearIndex: 2 };
    return claim;
  };
  for (const configure of [
    claim => { claim.state.phase = 3; },
    claim => { claim.state.players.bot.hand[0].unitCard = false; },
    claim => { claim.state.players.bot.rear[2] = { uid: "locked-unit", locked: true }; },
    claim => { claim.state.players.bot.hand[0].ownerPlayerId = "host-player"; }
  ]) {
    const claim = setup(); configure(claim); const before = JSON.stringify(claim.state);
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
      expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, false);
    assert.equal(JSON.stringify(claim.state), before);
  }
});

test("worker declares an exact boosted attack and queues the attacker's own AUTO", async () => {
  const cardId = "attack-auto-fixture";
  const text = "AUTO [RC]: When this unit attacks a vanguard, this unit gets power +3000 until end of battle.";
  Engine.registerAbilityDefinitions([{
    id: `${cardId}:0`, cardId, kind: "AUTO", printedText: text,
    source: { review: "worker attack declaration regression fixture" },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]
  }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const attacker = { ...claim.state.players.bot.rear[0], cardId, grade: 2, unitCard: true, power: 10000, critical: 1, drive: 1, rested: false, locked: false };
  const booster = { uid: "attack-booster", cardId: "boost-card", grade: 1, unitCard: true, boostAbility: true, power: 8000, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", rested: false, locked: false };
  const defender = { uid: "defending-vanguard", cardId: "defender-card", grade: 2, unitCard: true, power: 13000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.bot.rear[0] = attacker;
  claim.state.players.bot.rear[2] = booster;
  claim.state.players.human.vanguard = defender;
  claim.payload = { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: defender.uid, boosterCardInstanceId: booster.uid };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  const next = calls[1].args.p_next_state;
  assert.equal(next.pendingAttack.attackerUid, attacker.uid);
  assert.equal(next.pendingAttack.targetUid, defender.uid);
  assert.equal(next.pendingAttack.boostUid, booster.uid);
  assert.equal(next.pendingAttack.power, 18000);
  assert.equal(next.pendingAttack.targetPower, 13000);
  assert.equal(next.players.bot.rear[0].rested, true);
  assert.equal(next.players.bot.rear[2].rested, true);
  assert.equal(next.pendingAbility?.instance?.uid, attacker.uid);
  assert.equal(next.pendingAbility?.triggerControllerPlayerId, "guest-player");
  assert.deepEqual(calls[1].args.p_result.events.map(event => event.type), ["attack.step-started", "unit.boosted", "unit.attacked", "attack.declared"]);
  assert.equal(calls[1].args.p_result.events[1].boosterCardInstanceId, booster.uid);
  assert.equal(calls[1].args.p_result.events[1].boostedCardInstanceId, attacker.uid);
  assert.equal(calls[1].args.p_result.events[2].sourceCardInstanceId, attacker.uid);
  assert.equal(calls[1].args.p_result.events[3].subjectCardInstanceId, defender.uid);
});

test("trusted battle power applies Cycloned CONT only to an abilityless unit on its controller's turn", () => {
  const { loadCatalog } = require("./scripts/audit-ability-catalog");
  const card = loadCatalog().find(item => item.id === "cfa-7474");
  assert.ok(card);
  const abilities = Engine.parseCardAbilities(card);
  Engine.registerAbilityDefinitions(abilities.map(ability => ability.definition).filter(Boolean));
  const runAttack = hasAbilities => {
    const claim = claimedCommand(), state = claim.state;
    state.side = "bot"; state.phase = 5; state.turn = 6; state.firstTurnComplete = true;
    state.pendingAttack = null; state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
    state.players.bot.vanguard = { uid: "cycloned-source", cardId: "cfa-7474", cardName: card.name, type: "G Unit", grade: 4, gDeckCard: true, faceUp: true, hasAbilities: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", power: 15000, critical: 1 };
    const attacker = { uid: "power-target", cardId: "plain-unit", cardName: "Plain Unit", type: "Unit", unitCard: true, grade: 2, hasAbilities, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", power: 10000, critical: 1, rested: false };
    state.players.bot.rear = [attacker, null, null, null, null];
    state.players.human.vanguard = { uid: "opponent-vg", cardId: "opponent-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player", type: "Unit", grade: 3, hasAbilities: true, power: 13000, critical: 1, rested: false };
    return { state, result: Reducer.applyGameAction(state, {
      actorAuthUid: "auth-guest", actionId: `cycloned-attack-${hasAbilities}`, expectedStateVersion: state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: "opponent-vg" }
    }, Worker.seatMapping(claim), Engine) };
  };
  const abilityless = runAttack(false);
  assert.equal(abilityless.result.ok, true, JSON.stringify(abilityless.result));
  assert.equal(abilityless.state.pendingAttack.power, 15000);
  assert.equal(abilityless.state.pendingAbility, null);
  assert.equal(abilityless.state.pendingAbilities.length, 0);
  const skilled = runAttack(true);
  assert.equal(skilled.result.ok, true, JSON.stringify(skilled.result));
  assert.equal(skilled.state.pendingAttack.power, 10000);
});

test("attack declaration rejects wrong timing, rested attackers, and friendly targets without mutation", () => {
  const setup = () => {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.state.players.bot.rear[0] = { uid: "valid-attacker", cardId: "unit", unitCard: true, power: 8000, critical: 1, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
    claim.state.players.human.vanguard = { uid: "valid-target", cardId: "target", unitCard: true, power: 10000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
    claim.payload = { type: "game-action", action: "attack", attackerCardInstanceId: "valid-attacker", targetCardInstanceId: "valid-target" };
    return claim;
  };
  for (const configure of [
    claim => { claim.state.phase = 4; },
    claim => { claim.state.players.bot.rear[0].rested = true; },
    claim => { claim.state.players.human.vanguard.controllerPlayerId = "guest-player"; }
  ]) {
    const claim = setup(); configure(claim); const before = JSON.stringify(claim.state);
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
      expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, false);
    assert.equal(JSON.stringify(claim.state), before);
  }
});

test("only the defender can add guard and end defense, then the attacker chooses 0-10 drive checks", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  claim.state.pendingAttack = {
    battleId: "battle-guard-window", attackerSide: "bot", attackerUid: "attacker", attackerZone: "vanguard",
    defenderSide: "human", targetUid: "defender", targetZone: "vanguard", power: 18000, targetPower: 13000,
    critical: 1, guardCards: [], defenderDone: false, maxDriveChecks: 10, driveCountChosen: false
  };
  const guardCard = { uid: "guard-card", cardId: "shield", shield: 10000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.human.hand.push(guardCard);
  let actionId = 10;
  const apply = (actorAuthUid, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid, actionId: `battle-response-${actionId++}`, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);

  const wrongDefender = apply("auth-guest", { action: "guard", cardInstanceId: guardCard.uid });
  assert.equal(wrongDefender.reason, "not-defender-response-window");
  const guard = apply("auth-host", { action: "guard", cardInstanceId: guardCard.uid });
  assert.equal(guard.ok, true);
  assert.equal(claim.state.pendingAttack.targetPower, 23000);
  assert.ok(claim.state.players.human.guardCircle.some(card => card.uid === guardCard.uid));
  assert.equal(claim.state.pendingAttack.defenderDone, false);

  const noGuard = apply("auth-host", { action: "noGuard" });
  assert.equal(noGuard.ok, true);
  assert.equal(claim.state.pendingAttack.blocked, false);
  assert.equal(claim.state.pendingAttack.driveCountPrompt, true);
  const invalidCountState = JSON.stringify(claim.state);
  assert.equal(apply("auth-host", { action: "driveCount", count: 3 }).reason, "drive-count-not-available");
  assert.equal(apply("auth-guest", { action: "driveCount", count: 11 }).reason, "invalid-drive-count");
  assert.equal(JSON.stringify(claim.state), invalidCountState);
  const driveCount = apply("auth-guest", { action: "driveCount", count: 3 });
  assert.equal(driveCount.ok, true);
  assert.equal(claim.state.pendingAttack.driveCountChosen, true);
  assert.equal(claim.state.pendingAttack.driveChecksRemaining, 3);
  assert.equal(claim.state.pendingAttack.awaitingDrive, true);
});

test("Perfect Guard pays from the defending player's hand and opens the same Vanguard drive-count window", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  claim.state.pendingAttack = {
    battleId: "battle-perfect-guard", attackerSide: "bot", attackerUid: "attacker", attackerZone: "vanguard",
    defenderSide: "human", targetUid: "defender", targetZone: "vanguard", power: 30000, targetPower: 13000,
    critical: 1, guardCards: [], defenderDone: false, maxDriveChecks: 10, driveCountChosen: false
  };
  const marker = { uid: "perfect-guard", cardId: "sentinel", shield: 0, sentinel: true, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const cost = { uid: "perfect-guard-cost", cardId: "discard", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.human.hand.push(marker, cost);
  const outcome = Reducer.applyGameAction(claim.state, {
    actorAuthUid: "auth-host", actionId: "perfect-guard-action", expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: marker.uid, discardCardInstanceId: cost.uid }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(outcome.ok, true);
  assert.equal(claim.state.pendingAttack.perfectGuard, true);
  assert.equal(claim.state.pendingAttack.blocked, true);
  assert.equal(claim.state.pendingAttack.defenderDone, true);
  assert.equal(claim.state.pendingAttack.driveCountPrompt, true);
  assert.ok(claim.state.players.human.guardCircle.some(card => card.uid === marker.uid));
  assert.ok(claim.state.players.human.drop.some(card => card.uid === cost.uid));
  assert.deepEqual(outcome.events.map(event => event.type), ["card.discarded", "card.placed"]);
});

test("trusted guard calculation applies a reviewed Guardian Circle continuous shield ability", () => {
  const { loadCatalog } = require("./scripts/audit-ability-catalog");
  const card = loadCatalog().find(item => item.id === "cfa-12787");
  assert.ok(card);
  const ability = Engine.parseCardAbilities(card)[0];
  Engine.registerAbilityDefinitions([ability.definition]);
  const claim = claimedCommand(), state = claim.state;
  state.side = "bot"; state.phase = 5; state.turn = 2;
  state.pendingAbility = null; state.pendingAbilities = []; state.pendingTrigger = null;
  state.players.human.vanguard = { uid: "defender-grade-two", cardId: "defender-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player", grade: 2, type: "Unit", unitCard: true };
  state.players.bot.vanguard = { uid: "attacker-grade-three", cardId: "attacker-vg", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", grade: 3, type: "Unit", unitCard: true };
  state.pendingAttack = {
    battleId: "continuous-shield-battle", attackerSide: "bot", attackerUid: "attacker-grade-three", attackerZone: "vanguard",
    defenderSide: "human", targetUid: "defender-grade-two", targetZone: "vanguard", power: 25000, targetPower: 13000,
    critical: 1, guardCards: [], defenderDone: false, maxDriveChecks: 10, driveCountChosen: false
  };
  const guard = { uid: "continuous-shield-guard", cardId: "cfa-12787", shield: 5000, grade: 2, hasAbilities: true, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  state.players.human.hand.push(guard);
  const outcome = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-host", actionId: "continuous-shield-guard", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: guard.uid }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.equal(state.pendingAttack.targetPower, 23000);
  assert.equal(state.players.human.guardCircle[0].uid, guard.uid);
  assert.equal(state.pendingAttack.defenderDone, false);
});

test("trusted guard calculation resolves named-and-grade CONT shield only for the exact defense conditions",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog");
  const card=loadCatalog().find(item=>item.id==="cfa-12249"),definition=Engine.getReviewedAbilityDefinitionsForCard("cfa-12249").find(item=>item.source?.patternId==="cont-gc-named-grade-vanguard-shield-v1");
  assert.ok(card&&definition);
  for(const [vanguardGrade,vanguardName,expectedBonus] of [[3,"Triumph Dragon",10000],[2,"Triumph Dragon",0],[3,"Unrelated Dragon",0]]){
    const claim=claimedCommand(),state=claim.state;
    state.side="bot";state.phase=5;state.turn=2;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
    state.players.human.vanguard={uid:"named-shield-defender-vg",cardId:"test-defender",cardName:vanguardName,ownerPlayerId:"host-player",controllerPlayerId:"host-player",grade:vanguardGrade,power:13000,type:"Unit",unitCard:true};
    state.players.bot.vanguard={uid:"named-shield-attacker-vg",cardId:"test-attacker",cardName:"Opponent Vanguard",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",grade:3,power:25000,type:"Unit",unitCard:true};
    state.pendingAttack={battleId:"named-grade-shield-battle",attackerSide:"bot",attackerUid:"named-shield-attacker-vg",attackerZone:"vanguard",defenderSide:"human",targetUid:"named-shield-defender-vg",targetZone:"vanguard",power:25000,targetPower:13000,critical:1,guardCards:[],defenderDone:false,maxDriveChecks:10,driveCountChosen:false};
    const guard={uid:"named-grade-shield-card",cardId:card.id,shield:5000,grade:1,hasAbilities:true,ownerPlayerId:"host-player",controllerPlayerId:"host-player"};state.players.human.hand.push(guard);
    const outcome=Reducer.applyGameAction(state,{actorAuthUid:"auth-host",actionId:`named-shield-${vanguardGrade}-${vanguardName}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"guard",cardInstanceId:guard.uid}},Worker.seatMapping(claim),Engine);
    assert.equal(outcome.ok,true,JSON.stringify(outcome));
    assert.equal(state.pendingAttack.targetPower,18000+expectedBonus);
  }
});

test("trusted guard calculation applies named-Vanguard GC CONT shield to the defending player's guard only",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog");
  const card=loadCatalog().find(item=>item.id==="cfa-10076"),definition=Engine.getReviewedAbilityDefinitionsForCard("cfa-10076").find(item=>item.source?.patternId==="cont-gc-named-vanguard-shield-v1");
  assert.ok(card&&definition);
  for(const [vanguardName,expectedBonus] of [["Sorceress of the Full Moon, Full Moon Witch" ,10000],["Unrelated Vanguard",0]]){
    const claim=claimedCommand(),state=claim.state;
    state.side="bot";state.phase=5;state.turn=2;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
    state.players.human.vanguard={uid:"named-shield-defender-vg",cardId:"test-defender",cardName:vanguardName,ownerPlayerId:"host-player",controllerPlayerId:"host-player",grade:3,power:13000,type:"Unit",unitCard:true};
    state.players.bot.vanguard={uid:"named-shield-attacker-vg",cardId:"test-attacker",cardName:"Opponent Vanguard",ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",grade:3,power:25000,type:"Unit",unitCard:true};
    state.pendingAttack={battleId:"named-shield-battle",attackerSide:"bot",attackerUid:"named-shield-attacker-vg",attackerZone:"vanguard",defenderSide:"human",targetUid:"named-shield-defender-vg",targetZone:"vanguard",power:25000,targetPower:13000,critical:1,guardCards:[],defenderDone:false,maxDriveChecks:10,driveCountChosen:false};
    const guard={uid:"named-shield-card",cardId:card.id,shield:5000,grade:1,hasAbilities:true,ownerPlayerId:"host-player",controllerPlayerId:"host-player"};state.players.human.hand.push(guard);
    const outcome=Reducer.applyGameAction(state,{actorAuthUid:"auth-host",actionId:`named-shield-${vanguardName}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"guard",cardInstanceId:guard.uid}},Worker.seatMapping(claim),Engine);
    assert.equal(outcome.ok,true,JSON.stringify(outcome));
    assert.equal(state.pendingAttack.targetPower,18000+expectedBonus);
  }
});

test("authoritative attack power applies a printed non-clan continuous penalty using structured controller field clans",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog");
  const definition=loadCatalog().find(item=>item.id==="cfa-36");assert.ok(definition);
  const runAttack=withDifferentClan=>{
    const claim=claimedCommand(),state=claim.state;
    state.side="bot";state.phase=5;state.turn=2;state.pendingAttack=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
    const common={ownerPlayerId:"guest-player",controllerPlayerId:"guest-player",type:"Unit",unitCard:true,grade:3,rested:false,hasAbilities:true,critical:1};
    state.players.bot.vanguard={...common,uid:"shadow-vanguard",cardId:"shadow-vanguard",cardName:"Shadow Paladin Vanguard",clan:"Shadow Paladin",clans:["Shadow Paladin"],power:13000};
    state.players.bot.rear=[{...common,uid:"penalty-source",cardId:"cfa-36",cardName:definition.name,clan:definition.clan,clans:definition.clans,power:11000},withDifferentClan?{...common,uid:"foreign-clan-rear",cardId:"foreign",cardName:"Foreign Rear-Guard",clan:"Kagero",clans:["Kagero"],power:8000}:null,null,null,null];
    state.players.human.vanguard={...common,uid:"opponent-vanguard",cardId:"opponent",cardName:"Opponent Vanguard",ownerPlayerId:"host-player",controllerPlayerId:"host-player",clan:"Kagero",clans:["Kagero"],power:13000};
    const result=Reducer.applyGameAction(state,{actorAuthUid:"auth-guest",actionId:`non-clan-${withDifferentClan}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"attack",attackerCardInstanceId:"penalty-source",targetCardInstanceId:"opponent-vanguard"}},Worker.seatMapping(claim),Engine);
    return{state,result};
  };
  const sameClan=runAttack(false);assert.equal(sameClan.result.ok,true,JSON.stringify(sameClan.result));assert.equal(sameClan.state.pendingAttack.power,11000);
  const mixed=runAttack(true);assert.equal(mixed.result.ok,true,JSON.stringify(mixed.result));assert.equal(mixed.state.pendingAttack.power,9000);
});

test("authoritative GC guard uses the named-grade power/shield CONT on the correct player's Vanguard",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog");
  const card=loadCatalog().find(item=>item.id==="cfa-12534");assert.ok(card);
  for(const [grade,name,expected] of [[3,"Rezael Vanguard",23000],[2,"Rezael Vanguard",18000],[3,"Unrelated Vanguard",18000]]){
    const claim=claimedCommand(),state=claim.state;
    state.side="bot";state.phase=5;state.turn=2;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
    state.players.human.vanguard={uid:"defender-vg",cardId:"defender",cardName:name,grade,power:13000,type:"Unit",unitCard:true,ownerPlayerId:"host-player",controllerPlayerId:"host-player"};
    state.players.bot.vanguard={uid:"attacker-vg",cardId:"attacker",cardName:"Opponent Vanguard",grade:3,power:25000,type:"Unit",unitCard:true,ownerPlayerId:"guest-player",controllerPlayerId:"guest-player"};
    state.pendingAttack={battleId:"named-power-shield-battle",attackerSide:"bot",attackerUid:"attacker-vg",attackerZone:"vanguard",defenderSide:"human",targetUid:"defender-vg",targetZone:"vanguard",power:25000,targetPower:13000,critical:1,guardCards:[],defenderDone:false,maxDriveChecks:10,driveCountChosen:false};
    const guard={uid:"named-power-shield-source",cardId:card.id,shield:5000,grade:2,hasAbilities:true,ownerPlayerId:"host-player",controllerPlayerId:"host-player"};state.players.human.hand.push(guard);
    const outcome=Reducer.applyGameAction(state,{actorAuthUid:"auth-host",actionId:`named-power-shield-${grade}-${name}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"guard",cardInstanceId:guard.uid}},Worker.seatMapping(claim),Engine);
    assert.equal(outcome.ok,true,JSON.stringify(outcome));assert.equal(state.pendingAttack.targetPower,expected);
  }
});

test("ride-by-clan AUTO prompts only the controller of the exact ridden source for host and joining seats",()=>{
  for(const [side,authUid,playerId,riderClan,expectPrompt] of [["human","auth-host","host-player","Nova Grappler",true],["bot","auth-guest","guest-player","Nova Grappler",true],["bot","auth-guest","guest-player","Kagero",false]]){
    const claim=claimedCommand(),state=claim.state;state.side=side;state.phase=2;state.turn=2;state.ridePerformed=false;state.pendingAttack=null;state.pendingTurnEnd=null;state.pendingAbility=null;state.pendingAbilities=[];state.pendingTrigger=null;
    const player=state.players[side],old={uid:`old-vanguard-${side}-${riderClan}`,cardId:"cfa-104",cardName:"Battleraizer",clan:"Nova Grappler",clans:["Nova Grappler"],grade:1,type:"Unit",unitCard:true,hasAbilities:true,power:5000,critical:1,ownerPlayerId:playerId,controllerPlayerId:playerId};
    const rider={uid:`new-rider-${side}-${riderClan}`,cardId:`test-rider-${riderClan}`,cardName:`${riderClan} Rider`,clan:riderClan,clans:[riderClan],grade:2,type:"Unit",unitCard:true,hasAbilities:true,power:8000,critical:1,ownerPlayerId:playerId,controllerPlayerId:playerId};
    player.vanguard=old;player.hand=[rider];player.soul=[];player.rear=Array(5).fill(null);
    const outcome=Reducer.applyGameAction(state,{actorAuthUid:authUid,actionId:`ride-clan-${side}-${riderClan}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"ride",cardInstanceId:rider.uid}},Worker.seatMapping(claim),Engine);
    assert.equal(outcome.ok,true,JSON.stringify(outcome));
    if(expectPrompt){
      const pending=state.pendingAbility;assert.equal(pending?.instance?.uid,old.uid,JSON.stringify({pendingAbility:pending,pendingAbilities:state.pendingAbilities,events:outcome.events}));assert.equal(pending?.triggerControllerPlayerId,playerId);assert.equal(pending?.side,side);
      assert.equal(Engine.EFFECT_HANDLERS["call-source-from-soul"].validate(pending.ability.definition.effects[0],{source:old,player,callZone:"rear-left",cardDefinitionForInstance:instance=>({type:instance.type})}),true,JSON.stringify({soul:player.soul,rear:player.rear,old}));
      const resolved=Reducer.applyAbilityDecision(state,{actorAuthUid:authUid,actionId:`resolve-ride-clan-${side}-${riderClan}`,expectedStateVersion:state.stateVersion,payload:{accept:true,selection:{instanceUid:old.uid,abilityId:pending.ability.id,callZone:"rear-left"}}},Worker.seatMapping(claim),Engine);
      assert.equal(resolved.ok,true,JSON.stringify(resolved));assert.equal(state.players[side].rear[0]?.uid,old.uid);assert.equal(state.players[side].rear[0]?.rested,false);assert.equal(state.players[side].soul.some(card=>card.uid===old.uid),false);
    }else{assert.equal(state.pendingAbility,null);assert.equal(state.pendingAbilities.length,0)}
  }
});

test("Vanguard drive-count prompt accepts both inclusive limits, zero and ten", () => {
  for (const count of [0, 10]) {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
    claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
    claim.state.pendingAttack = {
      battleId: `drive-limit-${count}`, attackerSide: "bot", attackerZone: "vanguard", defenderSide: "human",
      targetUid: "target", targetZone: "vanguard", power: 10000, targetPower: 10000,
      defenderDone: true, driveCountPrompt: true, driveCountChosen: false, maxDriveChecks: 10
    };
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: "auth-guest", actionId: `choose-drive-${count}`, expectedStateVersion: claim.state.stateVersion,
      payload: { type: "game-action", action: "driveCount", count }
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, true);
    assert.equal(claim.state.pendingAttack.driveChecksRemaining, count);
    assert.equal(claim.state.pendingAttack.awaitingDrive, count > 0);
    assert.equal(claim.state.pendingAttack.driveChecksComplete, count === 0);
  }
});

test("drive checks reveal the exact card, then only its player resolves the trigger stages", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  claim.state.players.bot.vanguard = { uid: "guest-vanguard", cardId: "guest-vg", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.human.vanguard = { uid: "host-vanguard", cardId: "host-vg", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.pendingAttack = {
    battleId: "drive-check-battle", attackerSide: "bot", attackerUid: "guest-vanguard", attackerZone: "vanguard",
    attackerPlayerId: "guest-player", defenderSide: "human", targetUid: "host-vanguard", targetZone: "vanguard",
    power: 15000, targetPower: 10000, driveChecksRemaining: 1, driveChecksPerformed: 0,
    driveCountChosen: true, awaitingDrive: true
  };
  const trigger = { uid: "critical-trigger-instance", cardId: "critical-trigger", triggerType: "critical", triggerPower: 10000, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.deck.push(trigger);
  const apply = (authUid, id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);

  const checked = apply("auth-guest", "drive-check-once", { action: "driveCheck" });
  assert.equal(checked.ok, true);
  assert.equal(checked.events[0].type, "drive.checked");
  assert.equal(checked.events[0].checkedCardInstanceId, trigger.uid);
  assert.equal(checked.events[0].sourceCardInstanceId, "guest-vanguard");
  assert.equal(checked.events[0].battleId, "drive-check-battle");
  assert.equal(claim.state.players.bot.triggerZone.at(-1).uid, trigger.uid);
  assert.equal(claim.state.pendingAttack.driveChecksComplete, true);
  assert.equal(claim.state.pendingTrigger.stage, "critical-target");

  const wrongPlayer = apply("auth-host", "wrong-trigger-owner", { action: "triggerChoice", targetCardInstanceId: "guest-vanguard" });
  assert.equal(wrongPlayer.reason, "trigger-choice-not-available");
  const critical = apply("auth-guest", "critical-trigger-choice", { action: "triggerChoice", targetCardInstanceId: "guest-vanguard" });
  assert.equal(critical.ok, true);
  assert.equal(claim.state.players.bot.vanguard.turnCriticalBoost, 1);
  assert.equal(claim.state.players.bot.vanguard.turnCriticalExpiry, "bot");
  assert.equal(claim.state.pendingAttack.critical, 2);
  assert.equal(claim.state.pendingTrigger.stage, "power-target");
  const power = apply("auth-guest", "power-trigger-choice", { action: "triggerChoice", targetCardInstanceId: "guest-vanguard" });
  assert.equal(power.ok, true);
  assert.equal(claim.state.players.bot.vanguard.turnPowerBoost, 10000);
  assert.equal(claim.state.players.bot.hand.at(-1).uid, trigger.uid);
  assert.deepEqual(claim.state.players.bot.triggerZone, []);
  assert.equal(claim.state.pendingAttack.power, 25000);
  assert.equal(claim.state.pendingTrigger, null);
});

test("the Front Trigger effect resolves before its matching AUTO and the checked card remains in the trigger zone", () => {
  const cardId = "drive-critical-auto-source";
  const printedText = "AUTO [VC/RC] 1/Turn: When your drive check reveals a front trigger, you may have this unit get critical +1 until end of turn.";
  Engine.registerAbilityDefinitions([{ id: `${cardId}:0`, cardId, kind: "AUTO", printedText, source: { patternId: "auto-drive-check-front-trigger-critical-turn-v1", review: "drive-check trigger-order regression" }, effects: [{ op: "modify-critical", target: "source", amount: 1, duration: "turn" }] }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  claim.state.players.bot.vanguard = { uid: "critical-checker-vanguard", cardId: "vg", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const source = { uid: "drive-auto-source", cardId, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.rear[2] = source;
  const reveal = { uid: "front-drive-card", cardId: "front", triggerType: "front", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.deck.push(reveal);
  claim.state.pendingAttack = {
    battleId: "trigger-order-battle", attackerSide: "bot", attackerUid: "critical-checker-vanguard", attackerPlayerId: "guest-player",
    attackerZone: "vanguard", defenderSide: "human", targetUid: "host-target", targetZone: "vanguard",
    power: 10000, targetPower: 10000, critical: 1, driveChecksRemaining: 1, driveChecksPerformed: 0,
    awaitingDrive: true, driveChecksComplete: false, driveCountChosen: true
  };
  const apply = (id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: "auth-guest", actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);
  const check = apply("drive-critical-before-auto", { action: "driveCheck" });
  assert.equal(check.ok, true, check.reason);
  assert.equal(claim.state.pendingAbility?.instance.uid, source.uid, JSON.stringify({ events: check.events, queue: claim.state.pendingAbilities, source: Engine.locateCardInstance(claim.state, source.uid), trigger: claim.state.pendingTrigger, checked: claim.state.players.bot.triggerZone }));
  assert.equal(claim.state.pendingTrigger, null);
  assert.equal(claim.state.players.bot.vanguard.turnPowerBoost, 10000);
  assert.equal(claim.state.players.bot.triggerZone[0].uid, reveal.uid);
  assert.equal(claim.state.players.bot.hand.some(card => card.uid === reveal.uid), false);
  const auto = Reducer.applyAbilityDecision(claim.state, {
    actorAuthUid: "auth-guest", actionId: "resolve-drive-auto", expectedStateVersion: claim.state.stateVersion,
    payload: { accept: false, selection: { instanceUid: source.uid, abilityId: `${cardId}:0` } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(auto.ok, true, auto.reason);
  assert.equal(claim.state.players.bot.triggerZone.length, 0);
  assert.equal(claim.state.players.bot.hand.at(-1).uid, reveal.uid);
});

test("Stand Trigger prevents the selected rearguard from performing drive checks this turn", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const rested = claim.state.players.bot.rear[1]; rested.rested = true;
  claim.state.pendingAttack = {
    battleId: "stand-trigger-battle", attackerSide: "bot", attackerUid: "attacker", attackerZone: "vanguard",
    defenderSide: "human", targetUid: "target", targetZone: "vanguard", power: 10000, targetPower: 10000,
    defenderDone: true, driveChecksComplete: true, driveCountChosen: true
  };
  claim.state.pendingTrigger = { side: "bot", kind: "stand", stage: "stand-target", power: 10000, turnOwner: "bot", battleId: "stand-trigger-battle" };
  const apply = (id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: "auth-guest", actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(apply("stand-rearguard", { action: "triggerChoice", targetCardInstanceId: rested.uid }).ok, true);
  assert.equal(rested.rested, false);
  assert.equal(rested.cannotDriveChecksThisTurn, true);
  assert.equal(rested.cannotDriveChecksExpiry, "bot");
  assert.equal(apply("finish-stand-trigger", { action: "triggerChoice", targetCardInstanceId: rested.uid }).ok, true);
  Engine.expireTurnModifiers(claim.state, "bot");
  assert.equal(rested.cannotDriveChecksThisTurn, undefined);
});

test("trusted battle resolution rechecks power, resolves damage triggers before damage, and closes after all checks", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  const attacker = { uid: "battle-attacker", cardId: "attacker", unitCard: true, power: 18000, critical: 2, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const defender = { uid: "battle-defender", cardId: "defender", unitCard: true, power: 13000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.bot.vanguard = attacker;
  claim.state.players.human.vanguard = defender;
  claim.state.players.human.deck.push({ uid: "damage-plain", cardId: "plain", ownerPlayerId: "host-player", controllerPlayerId: "host-player" });
  claim.state.players.human.deck.push({ uid: "damage-critical", cardId: "critical", triggerType: "critical", ownerPlayerId: "host-player", controllerPlayerId: "host-player" });
  claim.state.pendingAttack = {
    battleId: "battle-damage-flow", attackerSide: "bot", attackerPlayerId: "guest-player", attackerUid: attacker.uid,
    attackerZone: "vanguard", defenderSide: "human", targetUid: defender.uid, targetZone: "vanguard",
    power: 18000, targetPower: 13000, critical: 2, guardCards: [], defenderDone: true,
    driveChecksComplete: true, driveCountChosen: true
  };
  const apply = (authUid, id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);

  const hit = apply("auth-guest", "resolve-damage-battle", { action: "resolveBattle" });
  assert.equal(hit.ok, true, hit.reason);
  assert.ok(hit.events.some(event => event.type === "attack.hit" && event.subjectCardInstanceId === defender.uid));
  assert.equal(claim.state.pendingAttack.damageChecksRemaining, 2);

  const firstCheck = apply("auth-host", "first-damage-check", { action: "damageCheck" });
  assert.equal(firstCheck.ok, true, firstCheck.reason);
  assert.equal(firstCheck.events.find(event => event.type === "damage.checked").checkedCardInstanceId, "damage-critical");
  assert.equal(claim.state.players.human.triggerZone[0].uid, "damage-critical");
  assert.equal(claim.state.pendingTrigger.side, "human");
  assert.equal(apply("auth-guest", "opponent-trigger-choice", { action: "triggerChoice", targetCardInstanceId: defender.uid }).reason, "trigger-choice-not-available");
  assert.equal(apply("auth-host", "damage-critical-choice", { action: "triggerChoice", targetCardInstanceId: defender.uid }).ok, true);
  assert.equal(claim.state.pendingTrigger.stage, "power-target");
  assert.equal(apply("auth-host", "damage-power-choice", { action: "triggerChoice", targetCardInstanceId: defender.uid }).ok, true);
  assert.equal(claim.state.players.human.triggerZone.length, 0);
  assert.equal(claim.state.players.human.damage[0].uid, "damage-critical");
  assert.equal(claim.state.pendingAttack.damageChecksRemaining, 1);

  const secondCheck = apply("auth-host", "second-damage-check", { action: "damageCheck" });
  assert.equal(secondCheck.ok, true, secondCheck.reason);
  assert.equal(claim.state.players.human.damage[1].uid, "damage-plain");
  assert.equal(claim.state.pendingAttack.damageChecksRemaining, 0);
  const close = apply("auth-guest", "close-damage-battle", { action: "resolveBattle" });
  assert.equal(close.ok, true, close.reason);
  assert.ok(close.events.some(event => event.type === "battle.close-step" && event.battleId === "battle-damage-flow"));
  assert.equal(claim.state.pendingAttack, null);
});

test("damage-check Over Trigger removes itself, draws, grants 100 million power, then allows remaining damage", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  const defender = { uid: "over-defender", cardId: "defender", unitCard: true, power: 13000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const over = { uid: "damage-over", cardId: "over", triggerType: "over", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const drawn = { uid: "over-draw", cardId: "drawn", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const nextDamage = { uid: "after-over-damage", cardId: "plain", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.human.vanguard = defender;
  claim.state.players.human.deck.push(nextDamage, drawn, over);
  claim.state.pendingAttack = {
    battleId: "damage-over-sequence", attackerSide: "bot", attackerPlayerId: "guest-player", attackerUid: "attacker",
    attackerZone: "vanguard", defenderSide: "human", targetUid: defender.uid, targetZone: "vanguard",
    damageChecksStarted: true, damageCheckSide: "human", damageChecksRemaining: 2, defenderDone: true,
    driveChecksComplete: true, driveCountChosen: true
  };
  const apply = (authUid, id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);

  const reveal = apply("auth-host", "reveal-damage-over", { action: "damageCheck" });
  assert.equal(reveal.ok, true, reveal.reason);
  assert.deepEqual(claim.state.players.human.removed.map(card => card.uid), [over.uid]);
  assert.deepEqual(claim.state.players.human.hand.map(card => card.uid), [drawn.uid]);
  assert.equal(claim.state.players.human.damage.length, 0);
  assert.equal(claim.state.pendingTrigger.stage, "over-target");
  assert.ok(reveal.events.some(event => event.type === "card.drawn" && event.cardInstanceId === drawn.uid));
  assert.equal(apply("auth-host", "early-next-damage", { action: "damageCheck" }).reason, "resolution-in-progress");

  const choice = apply("auth-host", "choose-over-power", { action: "triggerChoice", targetCardInstanceId: defender.uid });
  assert.equal(choice.ok, true, choice.reason);
  assert.equal(defender.turnPowerBoost, 100000000);
  assert.equal(claim.state.pendingAttack.damageChecksRemaining, 1);
  const next = apply("auth-host", "perform-next-damage", { action: "damageCheck" });
  assert.equal(next.ok, true, next.reason);
  assert.equal(claim.state.players.human.damage[0].uid, nextDamage.uid);
});

test("no-guard does not lock in a miss before drive-trigger power is resolved", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  const attacker = { uid: "late-power-attacker", cardId: "attacker", unitCard: true, power: 10000, critical: 1, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const defender = { uid: "late-power-defender", cardId: "defender", unitCard: true, power: 20000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.bot.vanguard = attacker;
  claim.state.players.human.vanguard = defender;
  claim.state.players.bot.deck.push({ uid: "draw-trigger-replacement", cardId: "plain", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  claim.state.players.bot.deck.push({ uid: "drive-draw", cardId: "draw", triggerType: "draw", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  claim.state.pendingAttack = {
    battleId: "late-power-battle", attackerSide: "bot", attackerPlayerId: "guest-player", attackerUid: attacker.uid,
    attackerZone: "vanguard", defenderSide: "human", targetUid: defender.uid, targetZone: "vanguard",
    power: 10000, targetPower: 20000, critical: 1, guardCards: [], defenderDone: false,
    driveCountChosen: false, maxDriveChecks: 10
  };
  const apply = (authUid, id, payload) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", ...payload }
  }, Worker.seatMapping(claim), Engine);
  const noGuard = apply("auth-host", "unblocked-defense", { action: "noGuard" });
  assert.equal(noGuard.ok, true, noGuard.reason);
  assert.equal(claim.state.pendingAttack.blocked, false);
  assert.equal(apply("auth-guest", "choose-late-drive", { action: "driveCount", count: 1 }).ok, true);
  assert.equal(apply("auth-guest", "late-power-drive-check", { action: "driveCheck" }).ok, true);
  assert.equal(claim.state.pendingAttack.blocked, false);
  assert.equal(claim.state.pendingTrigger.stage, "power-target");
  assert.equal(apply("auth-guest", "late-power-choice", { action: "triggerChoice", targetCardInstanceId: attacker.uid }).ok, true);
  assert.equal(claim.state.pendingAttack.power, 20000);
  const hit = apply("auth-guest", "late-power-resolve", { action: "resolveBattle" });
  assert.ok(hit.events.some(event => event.type === "attack.hit"));
});

test("six damage ends the match only after the final damage card finishes its trigger-zone resolution", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = []; claim.state.pendingTrigger = null;
  const lastDamage = { uid: "sixth-damage", cardId: "plain", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.human.damage = Array.from({ length: 5 }, (_, index) => ({ uid: `prior-damage-${index}`, cardId: `prior-${index}`, ownerPlayerId: "host-player", controllerPlayerId: "host-player" }));
  claim.state.players.human.deck.push(lastDamage);
  claim.state.pendingAttack = {
    battleId: "six-damage-battle", attackerSide: "bot", attackerUid: "attacker", attackerPlayerId: "guest-player",
    attackerZone: "vanguard", defenderSide: "human", targetUid: "host-vanguard", targetZone: "vanguard",
    damageChecksStarted: true, damageCheckSide: "human", damageChecksRemaining: 1, defenderDone: true,
    driveChecksComplete: true, driveCountChosen: true
  };
  claim.state.players.human.vanguard = { uid: "host-vanguard", cardId: "host-vg", power: 10000, ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const result = Reducer.applyGameAction(claim.state, {
    actorAuthUid: "auth-host", actionId: "resolve-sixth-damage", expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", action: "damageCheck" }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(claim.state.players.human.damage.length, 6);
  assert.equal(claim.state.ended, true);
  assert.equal(claim.state.loserSide, "human");
  assert.equal(claim.state.winnerSide, "bot");
  assert.ok(result.events.some(event => event.type === "game.ended" && event.reason === "six-damage"));
});

test("a drive check cannot be performed by the defender or repeated after the selected count is used", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 5; claim.state.turn = 2;
  claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  claim.state.pendingAttack = {
    battleId: "drive-check-auth", attackerSide: "bot", attackerUid: "attacker", attackerZone: "vanguard",
    defenderSide: "human", driveChecksRemaining: 1, driveChecksPerformed: 0, awaitingDrive: true
  };
  claim.state.players.bot.deck.push({ uid: "plain-top", cardId: "plain", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  const apply = (authUid, id) => Reducer.applyGameAction(claim.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion: claim.state.stateVersion,
    payload: { type: "game-action", action: "driveCheck" }
  }, Worker.seatMapping(claim), Engine);
  const before = JSON.stringify(claim.state);
  assert.equal(apply("auth-host", "defender-drive-check").reason, "drive-check-not-available");
  assert.equal(JSON.stringify(claim.state), before);
  assert.equal(apply("auth-guest", "legal-drive-check").ok, true);
  const after = JSON.stringify(claim.state);
  assert.equal(apply("auth-guest", "repeat-drive-check").reason, "drive-check-not-available");
  assert.equal(JSON.stringify(claim.state), after);
});

test("normal ride rejects invalid timing, grade, unit type, card restrictions, and once-per-turn repeats atomically", () => {
  const setup = () => {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 2; claim.state.turn = 2;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.state.players.bot.vanguard = { uid: "ride-old", cardId: "g0", grade: 0, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
    claim.state.players.bot.hand.push({ uid: "ride-card", cardId: "g1", grade: 1, unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
    claim.payload = { type: "game-action", action: "ride", cardInstanceId: "ride-card" };
    return claim;
  };
  for (const configure of [
    claim => { claim.state.phase = 1; },
    claim => { claim.state.players.bot.hand[0].grade = 2; },
    claim => { claim.state.players.bot.hand[0].unitCard = false; },
    claim => { claim.state.players.bot.hand[0].cannotBeRidden = true; },
    claim => { claim.state.players.bot.crests.push({ sameNameRideRestriction: true }); claim.state.players.bot.hand[0].cardName = "Different"; claim.state.players.bot.vanguard.cardName = "Original"; },
    claim => { claim.state.ridePerformed = true; }
  ]) {
    const claim = setup(); configure(claim); const before = JSON.stringify(claim.state);
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
      expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, false);
    assert.equal(JSON.stringify(claim.state), before);
  }
});

test("normal draw rejects wrong player, wrong phase, repeat draw, and loses on an empty deck", () => {
  const setup = () => {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 1; claim.state.turn = 2; claim.state.drewThisTurn = false;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.state.players.bot.deck.push({ uid: "turn-draw", cardId: "draw-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
    claim.payload = { type: "game-action", action: "draw" };
    return claim;
  };
  for (const configure of [
    claim => { claim.actorAuthUid = "auth-host"; },
    claim => { claim.state.phase = 2; },
    claim => { claim.state.drewThisTurn = true; }
  ]) {
    const claim = setup(); configure(claim); const before = JSON.stringify(claim.state);
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
      expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, false);
    assert.equal(JSON.stringify(claim.state), before);
  }

  const empty = setup(); empty.state.players.bot.deck = [];
  const loss = Reducer.applyGameAction(empty.state, {
    actorAuthUid: empty.actorAuthUid, actionId: empty.actionId,
    expectedStateVersion: empty.expectedStateVersion, payload: empty.payload
  }, Worker.seatMapping(empty), Engine);
  assert.equal(loss.ok, true);
  assert.equal(empty.state.ended, true);
  assert.equal(empty.state.winnerSide, "human");
  assert.equal(empty.state.loserSide, "bot");
  assert.equal(loss.events[0].type, "game.ended");
});

test("authoritative phase advance commits the Draw phase and its normal draw as one action", async () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 0; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const top = { uid: "phase-draw", cardId: "draw-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.deck.push(top);
  claim.payload = { type: "game-action", action: "advance" };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  const next = calls[1].args.p_next_state;
  assert.equal(next.phase, 1);
  assert.equal(next.drewThisTurn, true);
  assert.ok(next.players.bot.hand.some(card => card.uid === top.uid));
  assert.deepEqual(calls[1].args.p_result.events.map(event => event.type), ["phase.changed", "card.drawn"]);
  assert.equal(calls[1].args.p_result.events[0].after.phase, "draw");
  assert.equal(calls[1].args.p_result.events[1].subjectCardInstanceId, top.uid);
  assert.equal(next.stateVersion, 3);
});

test("authoritative phase advance rejects out-of-order and end-turn transitions without mutation", () => {
  for (const phase of [-1, 6]) {
    const claim = claimedCommand(); claim.state.side = "bot"; claim.state.phase = phase;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.payload = { type: "game-action", action: "advance" };
    const before = JSON.stringify(claim.state);
    const outcome = Reducer.applyGameAction(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
      expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(outcome.ok, false);
    assert.equal(JSON.stringify(claim.state), before);
  }
});

test("phase advance queues a reviewed phase-start AUTO for its owning player", () => {
  const cardId = "phase-auto-fixture";
  const text = "AUTO [VC]: At the beginning of your main phase, Soul Charge (1), and this unit gets power +5000 until end of turn.";
  Engine.registerAbilityDefinitions([{
    id: `${cardId}:0`, cardId, kind: "AUTO", printedText: text,
    source: { review: "worker phase-start regression fixture" },
    effects: [{ op: "soul-charge", count: 1 }, { op: "modify-power", target: "source", amount: 5000, duration: "turn" }]
  }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 3; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  claim.state.players.bot.vanguard = { uid: "phase-auto-source", cardId, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.payload = { type: "game-action", action: "advance" };
  const outcome = Reducer.applyGameAction(claim.state, {
    actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
    expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
  }, Worker.seatMapping(claim), Engine);
  assert.equal(outcome.ok, true);
  assert.equal(claim.state.phase, 4);
  assert.equal(claim.state.pendingAbility?.instance?.uid, "phase-auto-source");
  assert.equal(claim.state.pendingAbility?.triggerControllerPlayerId, "guest-player");
  assert.equal(claim.state.pendingAbility?.eventContext?.gameEvent?.phase, "main");
  assert.equal(claim.state.pendingAbility?.eventContext?.timingWindow, "phase-start");
});

test("authoritative End-phase action waits for end-turn AUTO before switching players", () => {
  const cardId = "end-turn-auto-fixture";
  const text = "AUTO [VC]: At the end of your turn, Soul Charge (1).";
  Engine.registerAbilityDefinitions([{
    id: `${cardId}:0`, cardId, kind: "AUTO", printedText: text,
    source: { review: "worker end-turn regression fixture" },
    effects: [{ op: "soul-charge", count: 1 }]
  }]);
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 6; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  claim.state.players.bot.vanguard = { uid: "end-turn-source", cardId, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.deck.push({ uid: "end-turn-soul", cardId: "soul-card", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" });
  claim.payload = { type: "game-action", action: "endTurn" };
  const outcome = Reducer.applyGameAction(claim.state, {
    actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
    expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
  }, Worker.seatMapping(claim), Engine);
  assert.equal(outcome.ok, true);
  assert.equal(claim.state.side, "bot");
  assert.equal(claim.state.turn, 2);
  assert.equal(claim.state.pendingTurnEnd.playerId, "guest-player");
  assert.equal(claim.state.pendingAbility?.instance?.uid, "end-turn-source");
  assert.equal(claim.state.pendingAbility?.triggerControllerPlayerId, "guest-player");
  assert.equal(claim.state.pendingAbility?.eventContext?.gameEvent?.type, "turn.ended");
  const decision = Reducer.applyAbilityDecision(claim.state, {
    actorAuthUid: claim.actorAuthUid, actionId: "resolve-end-turn-auto",
    expectedStateVersion: claim.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: "end-turn-source", abilityId: `${cardId}:0` } }
  }, Worker.seatMapping(claim), Engine);
  assert.equal(decision.ok, true, decision.reason);
  assert.equal(claim.state.players.bot.soul.length, 1);
  assert.equal(claim.state.side, "human");
  assert.equal(claim.state.turn, 3);
  assert.ok(decision.events.some(event => event.type === "turn.started"));
});

test("turn transition expires the ending player's modifiers and emits the next player's stand/start events", () => {
  const claim = claimedCommand();
  claim.state.side = "bot"; claim.state.phase = 6; claim.state.turn = 2;
  claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
  const heart = { uid: "ending-heart", cardId: "heart", grade: 3, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const strideHeart = { uid: "ending-stride-heart", cardId: "stride-heart", grade: 4, gDeckCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.vanguard = { uid: "ending-vg", cardId: "vg", grade: 4, gDeckCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", turnPowerBoost: 5000, turnPowerExpiry: "guest-player", strideHeart: heart, strideHearts: [heart, strideHeart] };
  claim.state.players.human.vanguard = { uid: "next-vg", cardId: "next-vg-card", ownerPlayerId: "host-player", controllerPlayerId: "host-player", rested: true };
  claim.payload = { type: "game-action", action: "endTurn" };
  const outcome = Reducer.applyGameAction(claim.state, {
    actorAuthUid: claim.actorAuthUid, actionId: claim.actionId,
    expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
  }, Worker.seatMapping(claim), Engine);
  assert.equal(outcome.ok, true);
  assert.equal(claim.state.side, "human");
  assert.equal(claim.state.phase, 0);
  assert.equal(claim.state.turn, 3);
  assert.equal(claim.state.drewThisTurn, false);
  assert.equal(claim.state.players.bot.vanguard.uid, "ending-heart");
  assert.ok(claim.state.players.bot.gZone.some(card => card.uid === "ending-vg" && card.faceUp));
  assert.ok(claim.state.players.bot.gZone.some(card => card.uid === "ending-stride-heart" && card.faceUp));
  assert.equal(claim.state.players.bot.gZone.find(card => card.uid === "ending-vg").turnPowerBoost, 0);
  assert.equal(claim.state.players.human.vanguard.rested, false);
  assert.deepEqual(outcome.events.map(event => event.type), ["turn.ended", "turn.started", "unit.stood"]);
  assert.equal(outcome.events[2].subjectCardInstanceId, "next-vg");
});

test("worker authorizes and resolves Arianrhod's reviewed ACT ability for the joining player's seat", async () => {
  const claim = claimedCommand();
  claim.state.side = "bot";
  claim.state.phase = 4;
  claim.state.turn = 1;
  claim.state.pendingAttack = null;
  claim.state.pendingAbility = null;
  claim.state.pendingAbilities = [];
  claim.state.players.bot.rear[0].cardId = MANUAL_CARD_ID;
  const discard = { uid: "discard-card", cardId: "discard-card-id", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const draw = { uid: "draw-card", cardId: "draw-card-id", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  claim.state.players.bot.hand.push(discard);
  claim.state.players.bot.deck.push(draw);
  claim.payload = {
    type: "manual-ability-activation", sourceCardInstanceId: "attacker", abilityId: MANUAL_ABILITY_ID,
    selection: { costSelections: { discard: [discard.uid] } }
  };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  assert.equal(calls[1].args.p_next_state.players.bot.rear[0].rested, true);
  assert.deepEqual(calls[1].args.p_next_state.players.bot.hand.map(card => card.uid), [draw.uid]);
  assert.equal(calls[1].args.p_next_state.players.bot.drop[0].uid, discard.uid);
  assert.equal(calls[1].args.p_result.resolvedAbilityId, MANUAL_ABILITY_ID);
  const resolutionEvent = calls[1].args.p_result.events.find(event => event.type === "card.drawn");
  assert.equal(resolutionEvent.type, "card.drawn");
  assert.equal(resolutionEvent.sourceCardInstanceId, "attacker");
  assert.equal(resolutionEvent.subjectCardInstanceId, draw.uid);
  assert.equal(resolutionEvent.subjectControllerPlayerId, "guest-player");
  assert.ok(resolutionEvent.eventId);
  assert.equal(calls[1].args.p_next_state.stateVersion, 3);
});

test("joining player resolves an optional-target Soul ACT locally and the authority enforces the target choice", async () => {
  const sample = Engine.getReviewedAbilityDefinitionsForCard("cfa-174").find(definition => definition.source?.patternId === "act-source-to-soul-optional-up-to-one-friendly-power-v1");
  assert.ok(sample);
  const amount = sample.effects[0].amount;
  const clan = sample.effects[0].targetFilter.clan;
  for (const chooseNone of [false, true]) {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 4; claim.state.turn = 1;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    const source = claim.state.players.bot.rear[0];
    source.cardId = sample.cardId; source.clan = clan; source.type = "Unit"; source.controllerPlayerId = "guest-player";
    const target = claim.state.players.bot.rear[1];
    target.cardId = "test-friendly-target"; target.clan = clan; target.type = "Unit"; target.controllerPlayerId = "guest-player";
    claim.payload = {
      type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: sample.id,
      selection: chooseNone ? { optionalNoTarget: true } : { targetUid: target.uid }
    };
    const calls = [];
    const rpc = async (name, args) => {
      calls.push({ name, args });
      if (name === "claim_match_action") return claim;
      if (name === "complete_match_action") return { ok: true, accepted: args.p_accepted, stateVersion: args.p_next_state?.stateVersion || claim.state.stateVersion };
      throw new Error(`unexpected RPC ${name}`);
    };
    const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
    assert.equal(result.accepted, true, result.result?.reason);
    const next = calls[1].args.p_next_state;
    assert.equal(next.players.bot.rear[0], null);
    assert.equal(next.players.bot.soul.at(-1).uid, source.uid);
    assert.equal(Number(target.turnPowerBoost || 0), chooseNone ? 0 : amount);
  }
});

test("worker authorizes and resolves the same reviewed ACT ability for the host player's seat", async () => {
  const claim = claimedCommand();
  claim.actorAuthUid = "auth-host";
  claim.state.side = "human";
  claim.state.phase = 4;
  claim.state.turn = 1;
  claim.state.pendingAttack = null;
  claim.state.pendingAbility = null;
  claim.state.pendingAbilities = [];
  const source = claim.state.players.bot.rear[0];
  source.ownerPlayerId = "host-player";
  source.controllerPlayerId = "host-player";
  source.cardId = MANUAL_CARD_ID;
  claim.state.players.bot.rear = [];
  claim.state.players.human.rear = [source];
  const discard = { uid: "host-discard", cardId: "discard-card-id", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const draw = { uid: "host-draw", cardId: "draw-card-id", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  claim.state.players.human.hand.push(discard);
  claim.state.players.human.deck.push(draw);
  claim.payload = {
    type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: MANUAL_ABILITY_ID,
    selection: { costSelections: { discard: [discard.uid] } }
  };
  const { calls, rpc } = rpcFor(claim);
  const result = await Worker.processRoomAction("0123456789ABCDEF", { rpc, engine: Engine, reducer: Reducer });
  assert.equal(result.accepted, true);
  assert.equal(calls[1].args.p_next_state.players.human.rear[0].rested, true);
  assert.deepEqual(calls[1].args.p_next_state.players.human.hand.map(card => card.uid), [draw.uid]);
  assert.equal(calls[1].args.p_next_state.players.human.drop[0].uid, discard.uid);
  assert.equal(calls[1].args.p_result.resolvedAbilityId, MANUAL_ABILITY_ID);
  const drawEvent = calls[1].args.p_result.events.find(event => event.type === "card.drawn");
  assert.equal(drawEvent.sourceCardInstanceId, source.uid);
  assert.equal(drawEvent.subjectCardInstanceId, draw.uid);
  assert.equal(drawEvent.subjectControllerPlayerId, "host-player");
});

test("server rejects forged, illegal-timing, and unaffordable Arianrhod ACT activations without changing state", () => {
  for (const configure of [
    claim => { claim.actorAuthUid = "auth-host"; },
    claim => { claim.state.phase = 3; },
    claim => { claim.state.players.bot.hand = []; }
  ]) {
    const claim = claimedCommand();
    claim.state.side = "bot"; claim.state.phase = 4; claim.state.turn = 1;
    claim.state.pendingAttack = null; claim.state.pendingAbility = null; claim.state.pendingAbilities = [];
    claim.state.players.bot.rear[0].cardId = MANUAL_CARD_ID;
    const discard = { uid: "discard-card", cardId: "discard-card-id", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
    claim.state.players.bot.hand.push(discard);
    claim.payload = { type: "manual-ability-activation", sourceCardInstanceId: "attacker", abilityId: MANUAL_ABILITY_ID, selection: { costSelections: { discard: [discard.uid] } } };
    configure(claim);
    const original = JSON.stringify(claim.state);
    const result = Reducer.applyManualAbilityActivation(claim.state, {
      actorAuthUid: claim.actorAuthUid, actionId: claim.actionId, expectedStateVersion: claim.expectedStateVersion, payload: claim.payload
    }, Worker.seatMapping(claim), Engine);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(claim.state), original);
  }
});
