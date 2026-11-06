"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0022.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cardById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
Engine.registerAbilityDefinitions(contribution.proposedDefinitions);
let sequence = 0;

function instance(cardId, uid, ownerPlayerId, overrides = {}) {
  const card = cardById.get(String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: card.name, type: card.type, grade: Number(card.grade),
    power: Number(card.power || 0), ownerPlayerId, controllerPlayerId: ownerPlayerId, ...overrides };
}

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [], damage: [], drop: [], bind: [],
    orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], usedAbilities: [] };
}

function fixture(side = "human", { soul = 1, bindTarget = true, targetOwner = null, targetCardId = null } = {}) {
  const number = ++sequence;
  const opponentSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const own = player(ownerId), opponent = player(opponentId);
  const source = instance("cfa-10584", `jakumetsu-${number}`, ownerId);
  const ownVanguard = instance("cfa-3", `own-vg-${number}`, ownerId);
  const opponentVanguard = instance("cfa-4", `opponent-vg-${number}`, opponentId);
  own.vanguard = ownVanguard;
  opponent.vanguard = opponentVanguard;
  own.rear[0] = source;
  own.soul = Array.from({ length: soul }, (_, index) => instance("cfa-2", `soul-${number}-${index}`, ownerId));

  const target = bindTarget
    ? instance(targetCardId || "cfa-3", `bind-target-${number}`, targetOwner || ownerId, { controllerPlayerId: opponentId, zone: "bind", faceUp: true })
    : null;
  if (target) opponent.bind.push(target);

  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const battleId = `battle-jakumetsu-${number}`;
  const state = { matchId: `match-jakumetsu-${number}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    pendingAttack: { battleId, closing: false, attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid, attackerZone: "rear-left",
      defenderSide: opponentSide, targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 }, players };
  const event = Engine.createGameEvent(state, { eventId: `unit-attacked-${number}`, type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], previousLocation: "rear-left", currentLocation: "rear-left",
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-declared" });
  const ability = Engine.parseCardAbilitiesCached(cardById.get("cfa-10584")).find(item => item.id === "cfa-10584:1");
  assert.ok(ability);
  return { state, side, opponentSide, ownerId, opponentId, own, opponent, source, target, ability, event, battleId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }

function resolve(f, { targetUid = f.target?.uid, accept = true, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid,
    actionId: `resolve-jakumetsu-${f.side}-${f.state.stateVersion}-${sequence}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid,
        costSelections: { cb: [], sb: accept ? f.own.soul.slice(0, 1).map(card => card.uid) : [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("Jakumetsu Arcs own-attack AUTO is reviewed for its exact RC source, Soul Blast cost, and opponent Bind target", () => {
  const f = fixture();
  assert.equal(f.ability.kind, "AUTO");
  assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
  assert.equal(f.ability.trigger.eventType, "unit.attacked");
  assert.equal(f.ability.trigger.subject, "source");
  assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count: 1 }]);
  assert.equal(f.ability.canDecline, true);
  assert.equal(f.ability.definition.source.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F017EN");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
});

test("host and joining player independently resolve their own attack AUTO and move the selected Bind card to the opponent's Deck", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, { targetOwner: side === "human" ? "player-host" : "player-guest" });
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.equal(f.state.pendingAbility.ability.id, "cfa-10584:1");
    const forged = resolve(f, { authUid: side === "human" ? seats.guestAuthUid : seats.hostAuthUid });
    assert.equal(forged.ok, false, "the opponent cannot resolve this player's ability");
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.own.soul, [], "the ability controller paid Soul Blast 1");
    assert.equal(f.opponent.bind.some(card => card.uid === f.target.uid), false);
    assert.equal(f.opponent.deck[0].uid, f.target.uid, "the target goes to the bind-zone player's Deck bottom");
    assert.equal(f.opponent.deck[0].ownerPlayerId, f.ownerId, "card ownership remains unchanged");
    assert.equal(f.opponent.deck[0].controllerPlayerId, f.opponentId);
    assert.equal(f.opponent.deck[0].faceUp, false);
    assert.equal(f.own.deck.some(card => card.uid === f.target.uid), false);
    const moved = result.events.find(event => event.type === "card.moved" && event.subjectCardInstanceId === f.target.uid);
    assert.ok(moved);
    assert.equal(moved.previousLocation, "bind");
    assert.equal(moved.currentLocation, "deck");
    assert.equal(moved.destinationPosition, "bottom");
    assert.equal(moved.sourceCardInstanceId, f.source.uid);
    assert.equal(moved.subjectOwnerPlayerId, f.ownerId);
    assert.equal(moved.subjectControllerPlayerId, f.opponentId);
  }
});

test("the cost can be declined once without moving cards, and repeated delivery cannot reprompt the same event", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const result = resolve(f, { accept: false });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.soul.length, 1);
  assert.equal(f.opponent.bind[0].uid, f.target.uid);
  assert.equal(discover(f).queued.length, 0);
});

test("it does not prompt for another unit's attack, a Vanguard attack, an unpaid cost, or an empty opponent Bind Zone", () => {
  const unrelated = fixture();
  const otherAttacker = instance("cfa-3", "unrelated-attacker", unrelated.ownerId);
  unrelated.own.rear[1] = otherAttacker;
  const unrelatedEvent = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: "unrelated-attack", sourceCardInstanceId: otherAttacker.uid,
    cardInstanceId: otherAttacker.uid, subjectCardInstanceId: otherAttacker.uid, attackingCardInstanceIds: [otherAttacker.uid] });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelatedEvent], Engine).queued.length, 0);

  const wrongCircle = fixture();
  wrongCircle.own.rear[0] = null;
  wrongCircle.own.vanguard = wrongCircle.source;
  wrongCircle.state.pendingAttack.attackerUid = wrongCircle.source.uid;
  wrongCircle.state.pendingAttack.attackerZone = "vanguard";
  const vanguardAttack = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "vanguard-attack", previousLocation: "vanguard", currentLocation: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [vanguardAttack], Engine).queued.length, 0);

  const noSoul = fixture("human", { soul: 0 });
  const noSoulResult = discover(noSoul);
  assert.equal(noSoulResult.queued.length, 0);
  assert.equal(noSoulResult.skipped.some(item => item.abilityId === "cfa-10584:1" && item.reason === "unpayable-cost"), true);

  const noBindTarget = fixture("human", { bindTarget: false });
  const noTargetResult = discover(noBindTarget);
  assert.equal(noTargetResult.queued.length, 0);
  assert.equal(noTargetResult.skipped.some(item => item.abilityId === "cfa-10584:1" && item.reason === "no-legal-targets"), true);
});

test("any card in the opponent Bind Zone can be selected, while a friendly Bind card and stale target are rejected atomically", () => {
  const orderDefinition = catalog.find(card => /\border\b/i.test(String(card.type || "")));
  assert.ok(orderDefinition, "catalog includes an Order to confirm the effect is not unit-only");
  const valid = fixture("human", { targetCardId: orderDefinition.id });
  assert.equal(discover(valid).queued.length, 1);
  assert.equal(resolve(valid).ok, true);
  assert.equal(valid.opponent.deck[0].cardId, String(orderDefinition.id));

  const friendlyTarget = fixture();
  const friendly = instance("cfa-3", "friendly-bind-target", friendlyTarget.ownerId, { zone: "bind" });
  friendlyTarget.own.bind.push(friendly);
  assert.equal(discover(friendlyTarget).queued.length, 1);
  const beforeFriendly = JSON.stringify(friendlyTarget.state);
  const rejectedFriendly = resolve(friendlyTarget, { targetUid: friendly.uid });
  assert.equal(rejectedFriendly.ok, false);
  assert.equal(JSON.stringify(friendlyTarget.state), beforeFriendly);

  const stale = fixture();
  assert.equal(discover(stale).queued.length, 1);
  stale.opponent.bind = [];
  const beforeStale = JSON.stringify(stale.state);
  const rejectedStale = resolve(stale);
  assert.equal(rejectedStale.ok, false);
  assert.equal(JSON.stringify(stale.state), beforeStale);
  assert.equal(stale.own.soul.length, 1, "invalid target does not partially pay the cost");
});
