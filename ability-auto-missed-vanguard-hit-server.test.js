"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cardRow = catalog.find(row => row.id === "cfa-11112");
assert.ok(cardRow, "representative real card exists in imported catalog");
const ability = Engine.parseCardAbilitiesCached(cardRow).find(item => item.id === "cfa-11112:2");
assert.ok(ability, "exact Vanguard attack-hit retire ability compiles");
assert.equal(ability.definition.source.patternId, "auto-vanguard-own-attack-hit-opponent-rear-retire-v1");
assert.equal(Reducer.supportsServerAbilityEffects(ability), true);

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;
function makeCard(uid, row, playerId) {
  return { uid, cardId: row.id, cardName: row.name, name: row.name, type: row.type, grade: Number(row.grade || 0), power: Number(row.power || 10000), critical: 1, unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(side = "human", sourceRow = cardRow) {
  const opponentSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence;
  const source = makeCard(`attacker-${n}`, sourceRow, playerId);
  const sourceAbility = Engine.parseCardAbilitiesCached(sourceRow).find(item => item.kind === "AUTO" && item.definition?.source?.patternId === "auto-vanguard-own-attack-hit-opponent-rear-retire-v1");
  const defenderRow = catalog.find(row => row.id === "cfa-3");
  const defender = makeCard(`defender-${n}`, defenderRow, opponentId);
  const targetRow = catalog.find(row => row.id === "cfa-2");
  const target = makeCard(`rear-${n}`, targetRow, opponentId);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  players[opponentSide].vanguard = defender;
  players[opponentSide].rear[0] = target;
  const battleId = `missed-vanguard-${n}`;
  const state = { matchId: "missed-vanguard-hit", stateVersion: 1, eventSequence: 0, turn: 2, phase: 5, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: source.uid, attackerSide: side, attackerPlayerId: playerId, attackerZone: "vanguard", targetUid: defender.uid, targetZone: "vanguard", defenderSide: opponentSide, defenderDone: true, power: 10000, targetPower: 20000, critical: 1 } };
  return { state, source, sourceAbility, target, playerId, side, battleId };
}

test("a missed Vanguard attack uses the same Vanguard's exact CONT and resolves its attack-hit AUTO for either player", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = Reducer.applyGameAction(f.state, { actorAuthUid: authUid, actionId: `resolve-miss-${f.side}`, expectedStateVersion: 1, payload: { action: "resolveBattle" } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    const event = result.events.find(item => item.attackHitOverride === true);
    assert.ok(event, "a typed did-not-hit attack event was emitted");
    assert.equal(event.didNotHit, true);
    assert.equal(event.subjectCardInstanceId, f.source.uid);
    assert.equal(event.attackingUnitInstanceId, f.source.uid);
    assert.deepEqual(event.targetCardInstanceIds, [f.state.pendingAttack.targetUid], "the event preserves the actual attacked Vanguard as context");
    assert.equal(f.state.pendingAbility?.side, side, "the source controller receives their own prompt");
    assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
    const resolve = Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `accept-miss-${f.side}`, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.sourceAbility.id, targetUid: f.target.uid } } }, seats, Engine);
    assert.equal(resolve.ok, true, resolve.reason);
    assert.ok(f.state.players[side === "human" ? "bot" : "human"].drop.some(card => card.uid === f.target.uid));
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].rear[0], null);
  }
});

test("the same AUTO does not trigger from a different Vanguard without the CONT", () => {
  const otherRow = catalog.find(row => row.id === "cfa-11706");
  assert.ok(otherRow);
  const f = fixture("human", otherRow);
  const result = Reducer.applyGameAction(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "resolve-miss-without-cont", expectedStateVersion: 1,
    payload: { action: "resolveBattle" } }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.events.some(item => item.attackHitOverride === true), false);
  assert.equal(f.state.pendingAbility, null);
  assert.equal((f.state.pendingAbilities || []).length, 0);
});
