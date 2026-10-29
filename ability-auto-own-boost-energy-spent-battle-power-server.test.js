"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-12959", "cfa-13480", "cfa-13521", "cfa-13557", "cfa-13573", "cfa-13596"];
const PATTERN = "auto-own-boost-energy-spent-battle-power-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function rowFor(id) { return catalog.find(row => String(row.id) === String(id)); }
function card(uid, cardId, playerId) {
  const row = rowFor(cardId);
  return { uid, cardId: String(cardId), cardName: row?.name || "Test Unit", type: "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human", energySpent = 3) {
  const row = rowFor(cardId), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const opponent = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(`booster-${n}`, cardId, ownerId), attacker = card(`attacker-${n}`, "cfa-1", ownerId), target = card(`target-${n}`, "cfa-3", opponentId);
  source.rested = true;
  const player = id => ({ playerId: id, energy: 0, energySpentThisTurn: id === ownerId ? energySpent : 0, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = attacker; players[side].rear[0] = source; players[opponent].vanguard = target;
  const battleId = `energy-boost-battle-${n}`;
  const state = { matchId: "auto-own-boost-energy-battle-power", stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: "vanguard", targetUid: target.uid, targetZone: "vanguard", defenderSide: opponent, power: 20000, targetPower: 10000, critical: 1, boostUid: source.uid, boostPower: 5000 } };
  const event = Engine.createGameEvent(state, { type: "unit.boosted", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid, previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left",
    targetLocation: "vanguard", targetCardInstanceIds: [attacker.uid], battleId, phase: "battle", timingWindow: "boost-step", after: { rested: true } });
  return { state, ability, event, source, attacker, side, ownerId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-energy-boost-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("six catalog abilities preserve their Energy Blast threshold and own-booster battle bonus", () => {
  for (const id of IDS) {
    const row = rowFor(id); assert.ok(row, id);
    const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${id}:0`);
    assert.ok(ability, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.match(ability.printedText, /Energy Blast 3 or more at the same time for the cost of your card’s ability this turn/);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.trigger.eventType, "unit.boosted");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.costs, [], "the recorded Energy Blast is a turn condition, not this AUTO's cost");
    assert.equal(Engine.parseAbilityCosts(ability.printedText).status, "no-cost");
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("the exact booster receives its own controller's +5000 battle effect on both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const proxy = resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(proxy.ok, false);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 25000);
  }
});

test("Energy Blast threshold, exact booster, battle, controller, and host proxy are revalidated", () => {
  const belowThreshold = fixture(IDS[0], "human", 2);
  assert.equal(discover(belowThreshold).queued.length, 0);
  const changedBeforeResolve = fixture(IDS[0], "bot", 3);
  assert.equal(discover(changedBeforeResolve).queued.length, 1);
  changedBeforeResolve.state.players.bot.energySpentThisTurn = 2;
  const before = JSON.stringify(changedBeforeResolve.state);
  assert.equal(resolve(changedBeforeResolve).ok, false);
  assert.equal(JSON.stringify(changedBeforeResolve.state), before);
  const f = fixture();
  for (const change of [
    { boosterCardInstanceId: "other", sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" },
    { boostedCardInstanceId: "other", targetCardInstanceIds: ["other"] },
    { battleId: "stale" },
    { sourceControllerPlayerId: "guest-player" },
    { timingWindow: "attack-declared" }
  ]) {
    const event = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(change));
  }
  const forged = structuredClone(f.ability);
  forged.definition.effects[0].amount = 10000;
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
