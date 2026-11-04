"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-order-zone-battle-phase-grant-back-row-boost-v1";
const FAMILY = ["cfa-12760", "cfa-12762", "cfa-12764"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === String(id));
const abilityFor = cardId => Engine.parseCardAbilitiesCached(byId(cardId)).find(ability => ability.id === `${cardId}:0`);

function cardInstance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...overrides };
}

function fixture({ cardId = FAMILY[0], side = "bot", withBackTarget = true, withFrontTarget = false } = {}) {
  const sourceDefinition = byId(cardId), ability = abilityFor(cardId);
  assert.ok(sourceDefinition, `catalog source ${cardId}`);
  assert.ok(ability, `compiled source ability ${cardId}:0`);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = cardInstance(sourceDefinition, `order-${side}-${cardId}`, ownerId, { faceUp: true });
  const rear = Array(5).fill(null);
  const backTarget = withBackTarget ? cardInstance(byId("cfa-98"), `back-target-${side}`, ownerId, { circle: "rear-back-left" }) : null;
  const frontTarget = withFrontTarget ? cardInstance(byId("cfa-98"), `front-target-${side}`, ownerId, { circle: "rear-left" }) : null;
  if (backTarget) rear[2] = backTarget;
  if (frontTarget) rear[0] = frontTarget;
  const own = { playerId: ownerId, vanguard: cardInstance(byId("cfa-98"), `vg-${side}`, ownerId), rear,
    soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [source], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: cardInstance(byId("cfa-98"), `opp-vg-${side}`, opponentId),
    rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `order-battle-boost-${cardId}-${side}`, stateVersion: 1, turn: 3, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "phase.changed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    phase: "battle", timingWindow: "phase-start", before: { phase: "main" }, after: { phase: "battle" } });
  return { state, event, ability, source, backTarget, frontTarget, own, opponent, side, ownerId, opponentId };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, targetUid, { actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
  actionId = `order-battle-boost-${f.ability.id}-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid,
      abilityId: f.ability.id, targetUid, costSelections: { cb: [], sb: [], discard: [] } } }
  }, seats, Engine);
}

test("all three official Set Orders compile only the exact Battle Phase back-row Boost AUTO", () => {
  for (const cardId of FAMILY) {
    const ability = abilityFor(cardId);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.trigger.eventType, "phase.changed");
    assert.equal(ability.trigger.requiredPhase, "battle");
    assert.equal(ability.trigger.requiredTimingWindow, "phase-start");
    assert.deepEqual(ability.requiredLocation, ["order"]);
    assert.deepEqual(ability.definition.effects, [{ op: "grant-temporary-boost", target: "chosen", duration: "turn",
      targetFilter: { controller: "source-controller", cardType: "unit", zone: "rear-guard", row: "back" } }]);
    assert.equal(ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the correct host or joining player alone chooses a back-row target and grants temporary Boost", () => {
  for (const cardId of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side, withBackTarget: true, withFrontTarget: true });
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const beforeOpponent = JSON.stringify(f.opponent);
    const forged = decide(f, f.backTarget.uid, { actor: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `forged-${side}-${cardId}` });
    assert.equal(forged.ok, false);
    const resolved = decide(f, f.backTarget.uid);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.backTarget.boostAbility, true);
    assert.equal(f.backTarget.temporaryBoostAbility, true);
    assert.equal(f.frontTarget.boostAbility, undefined, "front-row Rear-Guards are not legal targets");
    assert.equal(JSON.stringify(f.opponent), beforeOpponent, "other player's state is unchanged");
    assert.equal(f.state.pendingAbility, null);
  }
});

test("wrong phase, timing window, controller, source zone, and repeat events do not trigger", () => {
  const changes = [
    { phase: "main", before: { phase: "ride" }, after: { phase: "main" } },
    { timingWindow: "phase-action" },
    { actingPlayerId: "player-host", turnPlayerId: "player-host" },
  ];
  for (const change of changes) {
    const f = fixture();
    const altered = Engine.createGameEvent(f.state, { ...f.event, eventId: `invalid-${Object.keys(change)[0]}`, ...change });
    assert.equal(discover(f, altered).queued.length, 0, JSON.stringify(change));
  }
  const misplaced = fixture();
  misplaced.own.orders = [];
  misplaced.own.rear[3] = misplaced.source;
  assert.equal(discover(misplaced).queued.length, 0);
  const duplicate = fixture();
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(discover(duplicate).queued.length, 0);
});

test("no legal back-row target consumes the trigger without prompting, while a stale or front-row choice is rejected", () => {
  const empty = fixture({ withBackTarget: false, withFrontTarget: true });
  const skipped = discover(empty);
  assert.equal(skipped.queued.length, 0);
  assert.ok(skipped.skipped.some(item => item.reason === "no-legal-back-row-target"));
  assert.equal(discover(empty).queued.length, 0, "the same no-target event is not reprocessed");

  const f = fixture({ withBackTarget: true, withFrontTarget: true });
  discover(f);
  const before = JSON.stringify(f.state);
  const rejected = decide(f, f.frontTarget.uid, { actionId: "front-row-target-must-reject" });
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(f.state), before, "invalid target leaves the match unchanged");
  assert.equal(decide(f, f.backTarget.uid, { actionId: "valid-back-row-after-rejection" }).ok, true);
});
