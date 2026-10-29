"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = new Map(catalog.map(card => [String(card.id), card]));
const instance = (cardId, uid, playerId, extra = {}) => ({
  uid, cardId, cardName: byId.get(cardId)?.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra
});

function fixture(side = "human", soulCount = 1, changes = {}) {
  const card = byId.get("cfa-10097");
  const ability = Engine.parseCardAbilities(card).find(item => item.id === "cfa-10097:0");
  assert.ok(ability?.definition, "the exact card ability is in the production registry");
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance("cfa-10097", `attacker-${side}`, playerId, { power: 10000 });
  const vanguard = instance("cfa-10050", `vanguard-${side}`, playerId, { grade: 3 });
  const opponentVanguard = instance("cfa-3", `opponent-vanguard-${side}`, opponentId, { grade: 3 });
  const soul = Array.from({ length: soulCount }, (_, index) => instance("cfa-3", `soul-${side}-${index}`, playerId));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : instance("cfa-3", "host-vg", "player-host", { grade: 3 }), rear: side === "human" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "human" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : instance("cfa-3", "guest-vg", "player-guest", { grade: 3 }), rear: side === "bot" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "bot" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const attackZone = "rear-left";
  const state = {
    matchId: "mandatory-auto-cost-test", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players,
    pendingAttack: { battleId: `battle-${side}`, attackerSide: side, attackerUid: source.uid, attackerPlayerId: playerId, attackerZone: attackZone, defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 }
  };
  let event = Engine.createGameEvent(state, {
    eventId: `attack-${side}`, type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    attackingCardInstanceIds: [source.uid], previousLocation: attackZone, currentLocation: attackZone,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: `battle-${side}`,
    phase: "battle", timingWindow: "attack-declared"
  });
  event = { ...event, ...changes.event };
  return { state, event, ability, source, playerId, side, soul };
}

test("mandatory AUTO Soul Blast abilities do not queue without enough Soul for either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, 0);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 0);
    assert.equal(f.state.pendingAbility || null, null);
    assert.equal(f.state.pendingAbilities.length, 0);
    assert.equal(result.skipped.some(item => item.abilityId === f.ability.id && item.reason === "unpayable-cost"), true);
  }
});

test("legal cost queues to and resolves for the ability controller on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, 1);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const actorAuthUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid, actionId: `resolve-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { sb: f.soul.map(card => card.uid) } } }
    }, seats, Engine);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.state.players[side].soul.length, 0);
    assert.equal(f.state.players[side].drop.length, 1);
    assert.equal(f.state.pendingAttack.power, 15000);
  }
});

test("the trigger identity and Vanguard condition remain strict", () => {
  const wrongActor = fixture("human", 1, { event: { sourceCardInstanceId: "another-unit", cardInstanceId: "another-unit", subjectCardInstanceId: "another-unit", attackingCardInstanceIds: ["another-unit"] } });
  assert.equal(Reducer.discoverAutoTriggers(wrongActor.state, [wrongActor.event], Engine).queued.length, 0);
  const unrelatedVanguard = fixture("human", 1);
  unrelatedVanguard.state.players.human.vanguard = instance("cfa-3", "unrelated-vg", "player-host", { grade: 3 });
  const result = Reducer.discoverAutoTriggers(unrelatedVanguard.state, [unrelatedVanguard.event], Engine);
  assert.equal(result.queued.length, 0);
});
