"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1366", "Aqua Force"],
  ["cfa-417", "Oracle Think Tank"],
  ["cfa-718", "Angel Feather"]
]);
const VANGUARDS = new Map([
  ["Aqua Force", "cfa-98"],
  ["Oracle Think Tank", "cfa-426"],
  ["Angel Feather", "cfa-726"]
]);
const WRONG_CLAN_VANGUARD = "cfa-540";
const PATTERN = "auto-own-attack-hit-counter-blast-draw-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(uid, cardId, playerId) {
  const row = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: row?.name || "Test Unit", type: row?.type || "Unit",
    grade: Number(row?.grade || 0), clan: row?.clan, ownerPlayerId: playerId, controllerPlayerId: playerId };
}

function fixture(cardId = "cfa-1366", side = "human", { sourceCircle = "rear-guard", wrongClan = false, damageCount = 2 } = {}) {
  const row = catalog.find(item => item.id === cardId), clan = FAMILY.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 compiled ability`);
  const opponentSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const n = ++sequence;
  const source = card(`source-${n}`, cardId, ownerId);
  const sourceCircleLocation = sourceCircle === "vanguard" ? "vanguard" : "rear-left";
  const vanguard = wrongClan ? card(`vg-${n}`, WRONG_CLAN_VANGUARD, ownerId) : sourceCircle === "vanguard" ? source : card(`vg-${n}`, VANGUARDS.get(clan), ownerId);
  const target = card(`target-${n}`, WRONG_CLAN_VANGUARD, opponentId);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("player-host"), bot: player("player-guest") };
  players[side].vanguard = vanguard;
  players[opponentSide].vanguard = target;
  if (sourceCircle === "rear-guard") players[side].rear[0] = source;
  const damage = Array.from({ length: damageCount }, (_, index) => card(`damage-${n}-${index + 1}`, "cfa-3", ownerId));
  players[side].damage = damage;
  const drawn = card(`draw-${n}`, "cfa-3", ownerId), lower = card(`lower-${n}`, "cfa-4", ownerId);
  players[side].deck = [lower, drawn];
  const battleId = `battle-${n}`;
  const state = { matchId: "own-attack-hit-counter-blast-draw", stateVersion: 1, eventSequence: 0, turn: 2,
    phase: "battle", side, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: source.uid, attackerSide: side, attackerPlayerId: ownerId,
      attackerZone: sourceCircleLocation, targetUid: target.uid, targetZone: "vanguard", defenderSide: opponentSide,
      defenderPlayerId: opponentId, power: 20000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: opponentId,
    subjectControllerPlayerId: opponentId, targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    attackingUnitInstanceId: source.uid, currentLocation: sourceCircleLocation, battleId,
    phase: "battle", timingWindow: "attack-hit" });
  return { state, ability, event, source, target, damage, drawn, lower, side, opponentSide, ownerId, opponentId, battleId, clan };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decision(f, { auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true, costSelections } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-${f.source.uid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...(costSelections ? { costSelections } : {}) } }
  }, seats, Engine);
}

test("the three catalog abilities compile as the same exact optional VC/RC own-hit clan-CB2 draw family", () => {
  for (const [cardId, clan] of FAMILY) {
    const row = catalog.find(item => item.id === cardId);
    const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
    assert.ok(row);
    assert.match(ability.printedText, /AUTO \[VC\/RC\]: \[Counter Blast 2\] When this unit’s attack hits, if you have an «.+» vanguard, you may pay the cost\. If you do, draw a card\./);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.optional, true);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("a hit by a different unit and a non-hit attack event do not trigger this source", () => {
  const f = fixture("cfa-1366", "human", { sourceCircle: "rear-guard" });
  const otherAttacker = card("other-attacker", "cfa-3", f.ownerId);
  f.state.players[f.side].rear[1] = otherAttacker;
  f.state.pendingAttack.attackerUid = otherAttacker.uid;
  f.state.pendingAttack.attackerZone = "rear-right";
  const unrelatedHit = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined,
    sourceCardInstanceId: otherAttacker.uid, sourceOwnerPlayerId: f.ownerId, sourceControllerPlayerId: f.ownerId,
    attackingUnitInstanceId: otherAttacker.uid, currentLocation: "rear-right" });
  assert.equal(discover(f, unrelatedHit).queued.length, 0);

  const noHit = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, type: "unit.attacked",
    timingWindow: "attack-declared" });
  assert.equal(discover(f, noHit).queued.length, 0);
});

test("a wrong-clan vanguard and an insufficient Counter Blast do not offer the ability", () => {
  const wrongClan = fixture("cfa-1366", "human", { wrongClan: true });
  assert.equal(discover(wrongClan).queued.length, 0);

  const insufficient = fixture("cfa-417", "human", { damageCount: 1 });
  const result = discover(insufficient);
  assert.equal(result.queued.length, 0);
  assert.equal(result.skipped.some(item => item.abilityId === insufficient.ability.id && item.reason === "unpayable-cost"), true);
  assert.equal(insufficient.state.pendingAbility, null);
});

test("the controller may decline without paying damage or drawing", () => {
  const f = fixture("cfa-718", "human");
  assert.equal(discover(f).queued.length, 1);
  const result = decision(f, { accept: false });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.damage.map(item => item.faceDown === true), [false, false]);
  assert.deepEqual(f.state.players[f.side].hand, []);
  assert.deepEqual(f.state.players[f.side].deck, [f.lower, f.drawn]);
});

test("the host and joining player can resolve the exact source hit from VC or RC, pay their own CB2, and draw", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) for (const sourceCircle of ["vanguard", "rear-guard"]) {
    const f = fixture(cardId, side, { sourceCircle });
    const found = discover(f);
    assert.equal(found.queued.length, 1, `${cardId}/${side}/${sourceCircle}: ${JSON.stringify(found)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const result = decision(f, { costSelections: { cb: f.damage.map(item => item.uid) } });
    assert.equal(result.ok, true, `${cardId}/${side}/${sourceCircle}: ${result.reason}`);
    assert.deepEqual(f.damage.map(item => item.faceDown), [true, true]);
    assert.deepEqual(f.state.players[side].hand, [f.drawn]);
    assert.deepEqual(f.state.players[side].deck, [f.lower]);
  }
});

test("the host cannot resolve the joining player's ability and a stale CB payment is rejected", () => {
  const guest = fixture("cfa-1366", "bot");
  assert.equal(discover(guest).queued.length, 1);
  const proxy = decision(guest, { auth: seats.hostAuthUid, costSelections: { cb: guest.damage.map(item => item.uid) } });
  assert.equal(proxy.ok, false);
  assert.equal(guest.state.players.bot.hand.length, 0);

  const staleCost = fixture("cfa-417", "human");
  assert.equal(discover(staleCost).queued.length, 1);
  for (const item of staleCost.damage) item.faceDown = true;
  const rejected = decision(staleCost, { costSelections: { cb: staleCost.damage.map(item => item.uid) } });
  assert.equal(rejected.ok, false);
  assert.equal(staleCost.state.players.human.hand.length, 0);
});
