"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = Object.freeze([
  { id: "cfa-12754:0", name: "Flowering Sweet Shop", cardNumber: "DZ-SS01/025EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2F025EN" },
  { id: "cfa-12756:0", name: "Bustling Bleachers", cardNumber: "DZ-SS01/021EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2F021EN" },
  { id: "cfa-12758:0", name: "Hymn Brimming With Mercy", cardNumber: "DZ-SS01/023EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2F023EN" }
]);
const OFFICIAL_TEXT = 'AUTO [Order Zone] 1/Turn: When your unit is attacked, choose one of your rear-guards not being attacked, move it to GC, and it gets "[CONT]: When this unit would be retired from GC, bind it instead of retiring." until end of that battle.';

function definition(id) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  return catalog.find(card => String(card.id) === cardId);
}
function instance(cardId, uid, playerId, extra = {}) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || String(cardId), type: card?.type || "Unit", grade: Number(card?.grade || 0), shield: Number(card?.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(defenderSide = "bot", cardAbilityId = FAMILY[0].id, { rearTarget = false, noFriendlyRear = false } = {}) {
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const defenderId = defenderSide === "human" ? "player-host" : "player-guest";
  const attackerId = attackerSide === "human" ? "player-host" : "player-guest";
  const orderCardId = cardAbilityId.slice(0, cardAbilityId.lastIndexOf(":"));
  const order = instance(orderCardId, `order-${defenderSide}`, defenderId, { zone: "order", faceUp: true, position: "stand" });
  const attacker = instance("cfa-1", `attacker-${defenderSide}`, attackerId, { zone: "vanguard", circle: "vanguard", rested: true });
  const defenderVanguard = instance("cfa-1", `defender-vg-${defenderSide}`, defenderId, { zone: "vanguard", circle: "vanguard" });
  const friendlyRear = noFriendlyRear ? null : instance("cfa-1", `friendly-rear-${defenderSide}`, defenderId, { zone: "rear-guard", circle: "rear-left", position: "stand" });
  const attackedRear = rearTarget ? instance("cfa-1", `attacked-rear-${defenderSide}`, defenderId, { zone: "rear-guard", circle: "rear-right", position: "stand" }) : null;
  const players = {
    human: { playerId: "player-host", vanguard: defenderSide === "human" ? defenderVanguard : attacker, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: defenderSide === "bot" ? defenderVanguard : attacker, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  players[defenderSide].orders.push(order);
  if (friendlyRear) players[defenderSide].rear[0] = friendlyRear;
  if (attackedRear) players[defenderSide].rear[1] = attackedRear;
  const target = rearTarget ? attackedRear : defenderVanguard;
  const targetZone = rearTarget ? "rear-right" : "vanguard";
  const battleId = `order-bind-${defenderSide}-1`;
  const state = {
    matchId: "order-zone-attacked-bind", stateVersion: 2, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [],
    pendingAbilities: [], side: attackerSide, phase: 5, turn: 2, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide, attackerZone: "vanguard", attackerPlayerId: attackerId, defenderSide, targetUid: target.uid, targetZone, targetPower: 10000, power: 10000, critical: 1, guardCards: [], defenderDone: false }
  };
  const event = Engine.createGameEvent(state, {
    type: "attack.declared", actingPlayerId: attackerId, turnPlayerId: attackerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attackerId, sourceControllerPlayerId: attackerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderId, subjectControllerPlayerId: defenderId,
    currentLocation: targetZone, targetCardInstanceIds: [target.uid], targetLocation: targetZone,
    attackingUnitInstanceId: attacker.uid, battleId, phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, order, attacker, target, friendlyRear, defenderSide, attackerSide, defenderId };
}
function resolvePrompt(f, targetUid = f.friendlyRear.uid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.defenderSide === "human" ? "auth-host" : "auth-guest",
    actionId: `resolve-${f.state.pendingAbility?.eventContext?.eventId || f.event.eventId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.order.uid, abilityId: `${f.order.cardId}:0`, targetUid } }
  }, seats, Engine);
}

test("the three Festival Booster orders compile only to the exact Bushiroad AUTO and shared reviewed effect", () => {
  for (const record of FAMILY) {
    const card = definition(record.id);
    assert.ok(card, `${record.id}: catalog card exists`);
    assert.equal(card.name, record.name);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === record.id);
    assert.ok(ability);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.printedText, OFFICIAL_TEXT, `${record.id}: official wording (${record.url})`);
    assert.equal(ability.definition?.source?.officialCardNumber, record.cardNumber);
    assert.equal(ability.definition?.source?.officialReference, record.url);
    assert.equal(ability.definition?.consumeUsageOnTrigger, true);
    assert.deepEqual(ability.definition?.effects, [{ op: "move-rearguard-to-guardian-bind-instead", target: "chosen", targetFilter: { controller: "source-controller", cardType: "unit", zone: "rear-guard", notBeingAttacked: true }, destination: "guardian", duration: "battle", replacement: "bind-instead-of-retiring" }]);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    const tampered = structuredClone(ability);
    tampered.definition.effects[0].duration = "turn";
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, `${record.id}: altered effects must fail closed`);
  }
});

test("the correct host or joining player receives their Order AUTO when an opponent attacks their unit", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, JSON.stringify(result));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.order.uid);
    assert.equal(f.state.pendingAbility.ability.id, `${f.order.cardId}:0`);
    assert.equal(Engine.canDeclineAbility(f.state.pendingAbility.ability), false);
  }
});

test("host and joining player resolve their own choice and bind the selected Rear-Guard after battle", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, FAMILY[0].id, { rearTarget: true });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    const result = resolvePrompt(f);
    assert.equal(result.ok, true, result.reason);
    const defender = f.state.players[side];
    assert.equal(defender.rear[0], null);
    assert.equal(defender.guardCircle[0].uid, f.friendlyRear.uid);
    assert.equal(defender.guardCircle[0].gcBindInsteadOfRetireBattleId, f.state.pendingAttack.battleId);
    assert.equal(defender.guardCircle[0].gcBindInsteadOfRetireAbilitySourceUid, f.order.uid);
    assert.equal(f.state.pendingAttack.targetUid, f.target.uid);
    assert.equal(f.state.pendingAttack.guardCards[0].uid, f.friendlyRear.uid);
    assert.ok(defender.usedAbilities?.length);
    const ordinaryGuard = instance("cfa-1", `ordinary-guard-${side}`, f.defenderId, { zone: "guardian", circle: "guardian" });
    defender.guardCircle.push(ordinaryGuard);
    f.state.pendingAttack.guardCards.push(ordinaryGuard);

    f.state.pendingAttack.blocked = true;
    f.state.pendingAttack.defenderDone = true;
    const attackerAuthUid = f.attackerSide === "human" ? "auth-host" : "auth-guest";
    const closed = Reducer.applyGameAction(f.state, { actorAuthUid: attackerAuthUid, actionId: `close-bind-battle-${side}`, expectedStateVersion: f.state.stateVersion, payload: { action: "resolveBattle" } }, seats, Engine);
    assert.equal(closed.ok, true, closed.reason);
    assert.deepEqual(defender.bind.map(card => card.uid), [f.friendlyRear.uid]);
    assert.deepEqual(defender.guardCircle.map(card => card.uid), [ordinaryGuard.uid]);
    assert.equal(defender.drop.length, 0);
    assert.equal(defender.bind[0].gcBindInsteadOfRetireBattleId, undefined);
  }
});

test("the attacked unit cannot be selected as the Rear-Guard to move", () => {
  const f = fixture("human", FAMILY[1].id, { rearTarget: true });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = resolvePrompt(f, f.target.uid);
  assert.equal(result.ok, false);
  assert.match(result.reason, /target|filter|legal/i);
  assert.equal(f.state.players.human.rear[1].uid, f.target.uid);
  assert.equal(f.state.players.human.guardCircle.length, 0);
});

test("the once-per-turn Order does not trigger again, and it does not queue without an eligible Rear-Guard", () => {
  const f = fixture("bot", FAMILY[2].id);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(resolvePrompt(f).ok, true);
  f.state.pendingAbility = null;
  f.state.pendingAbilities = [];
  f.state.pendingAttack = null;
  const second = fixture("bot", FAMILY[2].id);
  second.state.players.bot.usedAbilities = [...f.state.players.bot.usedAbilities];
  second.state.turn = f.state.turn;
  assert.equal(Reducer.discoverAutoTriggers(second.state, [second.event], Engine).queued.length, 0);

  const noTarget = fixture("bot", FAMILY[2].id, { noFriendlyRear: true });
  const skipped = Reducer.discoverAutoTriggers(noTarget.state, [noTarget.event], Engine);
  assert.equal(skipped.queued.length, 0);
  assert.ok(skipped.skipped.some(item => item.reason === "no-legal-unattacked-rear-guard"));
});

test("stale or forged attack metadata cannot trigger the Order effect", () => {
  const f = fixture("bot");
  const forged = Object.freeze({ ...f.event, battleId: "another-battle" });
  const result = Reducer.discoverAutoTriggers(f.state, [forged], Engine);
  assert.equal(result.queued.length, 0);
  assert.equal(f.state.pendingAbility, undefined);
});
