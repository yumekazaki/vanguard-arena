"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-gc-opponent-second-attack-shield-v1";
const IDS = ["cfa-10188", "cfa-10444", "cfa-9685", "cfa-9687", "cfa-9688", "cfa-9689", "cfa-9690"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const definition = id => { const value = catalog.find(card => String(card.id) === id); assert.ok(value, `catalog card ${id}`); return value; };
const instance = (card, uid, playerId, extra = {}) => ({ uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade), shield: Number(card.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...(card.clan ? { clan: card.clan, clans: card.clans || [card.clan] } : {}), ...extra });

function fixture(cardId, side = "bot") {
  const card = definition(cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} belongs to the second-attack Intercept family`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = side === "human" ? "host" : "guest", opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest" : "host", authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const source = instance(card, `${side}-second-attack-guard`, ownerId, { zone: "guardian", circle: "guardian" });
  const vanguard = instance(definition("cfa-3"), `${side}-vg`, ownerId, { grade: 3 });
  const attacker = instance(definition("cfa-3"), `${opponentSide}-attacker`, opponentId, { grade: 3 });
  const owner = { playerId: ownerId, vanguard, rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: attacker, rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const attack = { battleId: "second-attack-intercept-battle", attackerSide: opponentSide, attackerUid: attacker.uid, attackerZone: "vanguard", defenderSide: side, targetUid: vanguard.uid, targetZone: "vanguard", guardCards: [source], power: 18000, targetPower: 10000, critical: 1 };
  const state = { matchId: "second-attack-intercept-match", stateVersion: 2, turn: 2, side: opponentSide, phase: 5, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players, pendingAttack: attack };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "rear-right", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "intercept", battleId: attack.battleId });
  return { state, event, source, ability, side, owner, opponent, authUid, attacker };
}

function setAttacks(f, count) {
  for (let index = 0; index < count; index++) Engine.recordAttackCount(f.state, f.opponent.playerId, f.attacker.uid);
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, authUid = f.authUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `second-attack-intercept-${f.side}`, expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all seven second-attack Intercept shields preserve their exact count and battle modifier", () => {
  const family = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) family.push(ability);
  assert.equal(family.length, IDS.length);
  assert.deepEqual(family.map(item => item.cardId).sort(), IDS.slice().sort());
  for (const ability of family) {
    assert.equal(ability.conditions[0].type, "opponent-attacking-unit-attacked-at-least");
    assert.equal(ability.conditions[0].count, 2);
    assert.equal(ability.definition.effects[0].amount, 15000);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    const altered = structuredClone(ability); altered.definition.effects[0].amount = 5000;
    assert.equal(Reducer.supportsServerAbilityEffects(altered), false);
  }
});

test("the joining defender's exact Guardian gains 15000 shield during the second or later opposing attack", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side); setAttacks(f, 2);
    assert.equal(discover(f).queued.length, 1, `${cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.targetPower, 25000);
    assert.equal(f.source.battleShieldBoost, 15000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
  }
});

test("first attack does not prompt; the active battle attacker, not the placed guard, supplies the count", () => {
  const f = fixture(IDS[0]); setAttacks(f, 1);
  assert.equal(discover(f).queued.length, 0);
  f.event = Engine.createGameEvent(f.state, { type: "card.placed", actingPlayerId: f.owner.playerId, turnPlayerId: f.opponent.playerId, sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.owner.playerId, sourceControllerPlayerId: f.owner.playerId, cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid, subjectOwnerPlayerId: f.owner.playerId, subjectControllerPlayerId: f.owner.playerId, previousLocation: "rear-right", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "intercept", battleId: f.state.pendingAttack.battleId });
  setAttacks(f, 1);
  assert.equal(discover(f).queued.length, 1);
});

test("attack count and defender identity are revalidated, and host cannot resolve the joining player's shield", () => {
  const stale = fixture(IDS[0]); setAttacks(stale, 2); assert.equal(discover(stale).queued.length, 1);
  stale.state.attacksByUnitTurn = {};
  const before = JSON.stringify(stale.state), rejected = resolve(stale);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(stale.state), before);

  const joined = fixture(IDS[0], "bot"); setAttacks(joined, 2); assert.equal(discover(joined).queued.length, 1);
  const proxy = resolve(joined, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(proxy.reason, "source-not-controlled");
});
