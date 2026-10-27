"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-intercept-shield-structured-condition-battle-v1";
const IDS = ["cfa-10101", "cfa-10182", "cfa-2840", "cfa-5165", "cfa-8453", "cfa-9585", "cfa-9604", "cfa-9626", "cfa-9738"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const definition = id => { const value = catalog.find(card => String(card.id) === id); assert.ok(value, `catalog card ${id}`); return value; };
const instance = (card, uid, playerId, extra = {}) => ({ uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade), shield: Number(card.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...(card.clan ? { clan: card.clan, clans: card.clans || [card.clan] } : {}), ...extra });

function fixture(cardId, side = "bot") {
  const sourceDef = definition(cardId), ability = Engine.parseCardAbilitiesCached(sourceDef).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} belongs to the structured Intercept family`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = side === "human" ? "host" : "guest", authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest" : "host";
  const source = instance(sourceDef, `${side}-structured-guard`, ownerId, { zone: "guardian", circle: "guardian" });
  const vanguard = instance(definition("cfa-3"), `${side}-vg`, ownerId, { grade: 3 });
  const opponentVanguard = instance(definition("cfa-3"), `${opponentSide}-vg`, opponentId, { grade: 3 });
  const owner = { playerId: ownerId, vanguard, rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const attack = { battleId: "structured-intercept-battle", attackerSide: opponentSide, attackerUid: opponentVanguard.uid, attackerZone: "vanguard", defenderSide: side, targetUid: vanguard.uid, targetZone: "vanguard", guardCards: [source], power: 18000, targetPower: 10000, critical: 1 };
  const state = { matchId: "structured-intercept-match", stateVersion: 4, turn: 2, side: opponentSide, phase: 5, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players, pendingAttack: attack };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "rear-right", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "intercept", battleId: attack.battleId });
  return { state, event, source, ability, side, owner, opponent, authUid };
}

function meetCondition(f, positive) {
  const type = f.ability.conditions[0].type, owner = f.owner, opponent = f.opponent;
  if (type === "controller-back-row-grade-rear-guards-at-least") { if (positive) owner.rear[2] = instance(definition("cfa-3"), "grade-one-a", owner.playerId, { grade: 1 }), owner.rear[3] = instance(definition("cfa-3"), "grade-one-b", owner.playerId, { grade: 1 }); }
  else if (type === "controller-damage-count-more-than-opponent") owner.damage = positive ? [{ uid: "d1" }, { uid: "d2" }] : [], opponent.damage = positive ? [{ uid: "od1" }] : [];
  else if (type === "controller-back-row-rear-guards-at-most") { if (!positive) owner.rear[2] = instance(definition("cfa-3"), "rear-a", owner.playerId), owner.rear[3] = instance(definition("cfa-3"), "rear-b", owner.playerId); }
  else if (type === "any-field-card-is-locked") { if (positive) owner.rear[2] = instance(definition("cfa-3"), "locked-unit", owner.playerId, { locked: true }); }
  else if (type === "opponent-rear-guards-at-most") { if (!positive) opponent.rear = [0, 1, 2].map(index => instance(definition("cfa-3"), `opp-rear-${index}`, opponent.playerId)); }
  else if (type === "controller-soul-count-at-least") owner.soul = positive ? Array.from({ length: 5 }, (_, i) => ({ uid: `soul-${i}` })) : [];
  else if (type === "all-order-zones-count-at-least") owner.orders = positive ? [{ uid: "owner-order" }] : [], opponent.orders = positive ? [{ uid: "opponent-order" }] : [];
  else if (type === "opponent-vanguard-grade-at-least") opponent.vanguard.grade = positive ? 3 : 2;
  else if (type === "controller-damage-count-at-least") owner.damage = positive ? Array.from({ length: 3 }, (_, i) => ({ uid: `damage-${i}` })) : [{ uid: "damage-1" }, { uid: "damage-2" }];
  else assert.fail(`Unexpected structured condition ${type}`);
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, authUid = f.authUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `structured-intercept-${f.side}`, expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all nine structured-condition Intercept shields are exact and only these reviewed definitions gain server support", () => {
  const family = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) family.push(ability);
  assert.equal(family.length, 9);
  assert.deepEqual(family.map(item => item.cardId).sort(), IDS.slice().sort());
  for (const item of family) assert.equal(Reducer.supportsServerAbilityEffects(item), true, item.id);
  for (const ability of family) {
    assert.equal(ability.definition.effects[0].amount, 10000);
    const altered = structuredClone(ability); altered.definition.effects[0].amount = 5000;
    assert.equal(Reducer.supportsServerAbilityEffects(altered), false, ability.id);
  }
});

test("each structured condition resolves on the exact defender's guard for either seat", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side); meetCondition(f, true);
    const found = discover(f);
    assert.equal(found.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(found.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.targetPower, 20000);
    assert.equal(f.source.battleShieldBoost, 10000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
  }
});

test("every structured condition blocks its false case without making a prompt", () => {
  for (const cardId of IDS) {
    const f = fixture(cardId); meetCondition(f, false);
    const found = discover(f);
    assert.equal(found.queued.length, 0, `${cardId}: ${JSON.stringify(found.skipped)} conditions=${JSON.stringify(f.state.pendingAbility?.ability?.conditions)} rear=${JSON.stringify(f.owner.rear)}`);
    assert.equal(f.state.pendingAbility || null, null);
  }
});

test("structured Intercept conditions are rechecked on resolution and the host cannot proxy", () => {
  const stale = fixture("cfa-9585"); meetCondition(stale, true); assert.equal(discover(stale).queued.length, 1);
  stale.owner.soul = [];
  const before = JSON.stringify(stale.state), rejected = resolve(stale);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "intercept-shield-condition-no-longer-met");
  assert.equal(JSON.stringify(stale.state), before);

  const joined = fixture("cfa-9585", "bot"); meetCondition(joined, true); assert.equal(discover(joined).queued.length, 1);
  const proxy = resolve(joined, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(proxy.reason, "source-not-controlled");
});
