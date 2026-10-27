"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rode-upon-second-player-draw-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardDefinition = id => { const card = catalog.find(item => String(item.id) === String(id)); assert.ok(card, `card ${id}`); return card; };
const card = (definition, uid, playerId, extra = {}) => ({ uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", grade: Number(definition.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...(definition.clan ? { clan: definition.clan, clans: definition.clans || [definition.clan] } : {}), ...extra });

function fixture({ cardId = "cfa-8287", side = "bot", wentSecond = true, eventType = "card.ridden", targetUid, timingWindow = "normal-ride" } = {}) {
  const oldVanguardDefinition = cardDefinition(cardId);
  const ability = Engine.parseCardAbilitiesCached(oldVanguardDefinition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} is a reviewed ride-draw card`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = side === "human" ? "host" : "guest", opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest" : "host";
  const oldVanguard = card(oldVanguardDefinition, `${side}-old-vanguard`, ownerId);
  const rider = card(cardDefinition("cfa-3"), `${side}-new-rider`, ownerId, { grade: 1 });
  const opponentVanguard = card(cardDefinition("cfa-3"), `${opponentSide}-vanguard`, opponentId, { grade: 3 });
  const owner = { playerId: ownerId, vanguard: rider, rear: [null, null, null, null, null], hand: [], deck: [{ uid: `${side}-draw`, cardId: "normal-card", ownerPlayerId: ownerId, controllerPlayerId: ownerId }], soul: [oldVanguard], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null], hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const state = { matchId: "ride-draw-match", stateVersion: 3, eventSequence: 0, turn: 1, side, firstSide: wentSecond ? opponentSide : side, phase: 2, players, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAttack: null };
  const event = Engine.createGameEvent(state, {
    type: eventType, actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [targetUid || oldVanguard.uid],
    targetOwnerPlayerId: ownerId, targetControllerPlayerId: ownerId,
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow,
  });
  return { state, event, ability, side, owner, opponent, oldVanguard, rider, ownerId, authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, authUid = f.authUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `ride-draw-${f.side}`, expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: f.oldVanguard.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all 153 catalog ride-draw abilities bind to the ridden Vanguard and exact second-player condition", () => {
  const abilities = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) if (ability.definition?.source?.patternId === PATTERN) abilities.push(ability);
  assert.equal(abilities.length, 153);
  assert.equal(new Set(abilities.map(ability => ability.cardId)).size, 153);
  for (const ability of abilities) {
    assert.equal(ability.id, ability.definition.id);
    assert.equal(ability.trigger.eventType, "card.ridden");
    assert.equal(ability.trigger.subject, "event-target");
    assert.deepEqual(ability.trigger.circles, ["vanguard"]);
    assert.deepEqual(ability.conditions, [{ type: "controller-went-second" }]);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("both host and joining player draw only from their exact prior Vanguard after riding when they went second", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ side });
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.oldVanguard.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.owner.deck.length, 0);
    assert.equal(f.owner.hand[0].uid, `${side}-draw`);
    assert.equal(f.owner.hand[0].ownerPlayerId, f.ownerId);
    assert.equal(f.opponent.hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn"]);
    assert.equal(result.events[0].sourceCardInstanceId, f.oldVanguard.uid);
    assert.equal(result.events[0].subjectControllerPlayerId, f.ownerId);
  }
});

test("going first, a call, the wrong ridden instance, and a non-Ride timing event do not prompt", () => {
  assert.equal(discover(fixture({ wentSecond: false })).queued.length, 0);
  assert.equal(discover(fixture({ eventType: "card.placed" })).queued.length, 0);
  assert.equal(discover(fixture({ targetUid: "unrelated-vanguard" })).queued.length, 0);
  assert.equal(discover(fixture({ timingWindow: "stride" })).queued.length, 0);
});

test("the condition is rechecked at resolution and the host cannot resolve the joining player's draw", () => {
  const stale = fixture({ side: "bot" });
  assert.equal(discover(stale).queued.length, 1);
  stale.state.firstSide = "bot";
  const before = JSON.stringify(stale.state), rejected = resolve(stale);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ride-draw-condition-no-longer-met");
  assert.equal(JSON.stringify(stale.state), before);

  const joined = fixture({ side: "bot" });
  assert.equal(discover(joined).queued.length, 1);
  const proxy = resolve(joined, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(proxy.reason, "source-not-controlled");
  assert.equal(joined.owner.deck.length, 1);
});
