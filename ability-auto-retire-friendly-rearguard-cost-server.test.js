"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-2000:1", "cfa-2239:2", "cfa-2271:2", "cfa-2173:1"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => catalog.find(card => String(card.id) === String(id));

function fixture(id = IDS[0], side = "human", { withTarget = true, legion = false } = {}) {
  const cardId = id.split(":")[0], card = cardFor(cardId);
  const ability = Engine.parseCardAbilities(card).find(item => item.id === id);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `vanguard-${side}`, cardId, cardName: card.name, grade: Number(card.grade), ownerPlayerId: ownerId, controllerPlayerId: ownerId, zone: "vanguard", circle: "vanguard", power: Number(card.power) || 10000, ...(legion ? { legionMateInstanceId: `mate-${side}` } : {}) };
  const targetVanguard = { uid: `opponent-vanguard-${side}`, cardId: "opponent-vanguard", cardName: "Opponent Vanguard", grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId, zone: "vanguard", circle: "vanguard" };
  const friendlyTarget = { uid: `friendly-target-${side}`, cardId: "cfa-10", cardName: "Friendly Rear-Guard", grade: 1, ownerPlayerId: ownerId, controllerPlayerId: ownerId, zone: "rear-guard", circle: "rear-left" };
  const opponentRear = { uid: `opponent-rear-${side}`, cardId: "cfa-10", cardName: "Opponent Rear-Guard", grade: 1, ownerPlayerId: opponentId, controllerPlayerId: opponentId, zone: "rear-guard", circle: "rear-left" };
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  if (withTarget) players[side].rear[0] = friendlyTarget;
  players[opponentSide].vanguard = targetVanguard;
  players[opponentSide].rear[0] = opponentRear;
  const state = { matchId: "retire-friendly-rear-cost", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players,
    pendingAttack: { battleId: `battle-${side}`, attackerUid: source.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: "vanguard", defenderSide: opponentSide, targetUid: targetVanguard.uid, targetZone: "vanguard", power: Number(source.power), critical: 1, targetPower: 13000 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid], previousLocation: "vanguard", currentLocation: "vanguard",
    targetCardInstanceIds: [targetVanguard.uid], targetLocation: "vanguard", battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared" });
  return { id, card, ability, side, ownerId, opponentSide, source, friendlyTarget, opponentRear, targetVanguard, state, event };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decide(f, { accept = true, targetUid = f.friendlyTarget?.uid, actor = null, actionId = `resolve-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid), actionId,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept,
      selection: { instanceUid: f.source.uid, abilityId: f.id, costSelections: { cb: [], sb: [], discard: [], reveal: [], retireRearGuard: targetUid ? [targetUid] : [] } } } }, seats, Engine);
}

test("the four exact catalog abilities compile with their distinct battle effects", () => {
  for (const id of IDS) {
    const f = fixture(id, "human", { legion: id === "cfa-2173:1" });
    assert.ok(f.ability.definition, id);
    assert.equal(f.ability.definition.source.patternId, "auto-vanguard-attack-retire-friendly-rearguard-cost-battle-modifier-v1");
    assert.deepEqual(f.ability.costs, [{ type: "retire-rear-guard", count: 1, targetFilter: { controller: "source-controller", zone: "rear-guard" } }]);
    assert.equal(f.ability.canDecline, true);
    assert.equal(f.ability.choiceStatus, "modeled");
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
  assert.deepEqual(fixture(IDS[0]).ability.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]);
  assert.deepEqual(fixture(IDS[3], "human", { legion: true }).ability.effects, [{ op: "modify-critical", target: "source", amount: 1, duration: "battle" }]);
});

test("host and joining player pay by selecting their own exact Rear-Guard instance", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const actor = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const forged = decide(f, { actor: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `forged-${side}` });
    assert.equal(forged.ok, false);
    assert.equal(f.state.players[side].rear[0], f.friendlyTarget);
    const result = decide(f);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.state.players[side].rear[0], null);
    assert.equal(f.state.players[side].drop[0], f.friendlyTarget);
    assert.equal(f.state.players[side].drop[0].controllerPlayerId, f.ownerId);
    assert.equal(f.state.pendingAttack.power, Number(f.source.power) + 5000);
    assert.equal(f.state.pendingAbility, null);
    assert.equal(decide(f, { actionId: `duplicate-${side}` }).ok, false);
    assert.equal(f.state.players[side].drop.filter(card => card.uid === f.friendlyTarget.uid).length, 1);
  }
});

test("Legion is checked on the source Vanguard, and the critical modifier is battle-scoped", () => {
  const missing = fixture(IDS[3], "human", { legion: false });
  assert.equal(discover(missing).queued.length, 0);
  const f = fixture(IDS[3], "bot", { legion: true });
  assert.equal(discover(f).queued.length, 1);
  assert.equal(decide(f).ok, true);
  assert.equal(f.state.pendingAttack.critical, 2);
  assert.equal(f.state.players.bot.vanguard.turnCriticalBoost || 0, 0);
});

test("wrong attacker, target, circle, and timing cannot make the ability eligible", () => {
  const wrongAttacker = fixture();
  wrongAttacker.event = { ...wrongAttacker.event, sourceCardInstanceId: "other-attacker", cardInstanceId: "other-attacker", subjectCardInstanceId: "other-attacker", attackingUnitInstanceIds: ["other-attacker"], attackingCardInstanceIds: ["other-attacker"] };
  assert.equal(discover(wrongAttacker).queued.length, 0);
  const wrongTarget = fixture();
  wrongTarget.event = { ...wrongTarget.event, targetCardInstanceIds: [wrongTarget.opponentRear.uid], targetLocation: "rear-left" };
  assert.equal(discover(wrongTarget).queued.length, 0);
  const wrongCircle = fixture();
  wrongCircle.event = { ...wrongCircle.event, currentLocation: "rear-left", previousLocation: "rear-left" };
  assert.equal(discover(wrongCircle).queued.length, 0);
  const wrongTiming = fixture();
  wrongTiming.event = { ...wrongTiming.event, phase: "main", timingWindow: "main-action" };
  assert.equal(discover(wrongTiming).queued.length, 0);
});

test("empty or opponent-controlled target, duplicate selection, and unpayable resources reject atomically", () => {
  const empty = fixture(IDS[0], "human", { withTarget: false });
  assert.equal(discover(empty).queued.length, 0);
  assert.equal(empty.state.pendingAbility || null, null);

  for (const targetCase of ["opponent", "duplicate", "controller-mismatch"]) {
    const f = fixture();
    assert.equal(discover(f).queued.length, 1);
    if (targetCase === "controller-mismatch") f.friendlyTarget.controllerPlayerId = "guest-player";
    const before = JSON.stringify(f.state);
    const result = targetCase === "duplicate"
      ? Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "duplicate-cost-target", expectedStateVersion: f.state.stateVersion,
          payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.id, costSelections: { cb: [], sb: [], discard: [], reveal: [], retireRearGuard: [f.friendlyTarget.uid, f.friendlyTarget.uid] } } } }, seats, Engine)
      : decide(f, { targetUid: targetCase === "opponent" ? f.opponentRear.uid : f.friendlyTarget.uid });
    assert.equal(result.ok, false, targetCase);
    assert.equal(JSON.stringify(f.state), before, targetCase);
  }

  const paidText = "AUTO [RC]: [Counter Blast 1 & Choose one of your other rear-guards, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, draw a card.";
  const parsedCosts = Engine.parseAbilityCosts(paidText);
  assert.equal(parsedCosts.status, "supported-cost");
  assert.deepEqual(parsedCosts.costs.map(cost => cost.type), ["counter-blast", "retire-rear-guard"]);
  assert.equal(Engine.canPayAbilityCosts({ costs: parsedCosts.costs }, { faceUpDamage: 0, retirableRearGuards: [{ uid: "ally" }], actorPlayerId: "p1" }), false);
  const atomic = fixture();
  atomic.state.players.human.damage = [{ uid: "face-down-cost", faceDown: true }];
  const beforeUnpayable = JSON.stringify(atomic.state);
  const paid = Engine.payAbilityCosts({ ...atomic.ability, costs: parsedCosts.costs }, {
    player: atomic.state.players.human, source: atomic.source, sourceZone: "vanguard", actorPlayerId: atomic.ownerId,
    turnId: atomic.state.turn, side: "human", match: atomic.state
  }, { cb: ["face-down-cost"], retireRearGuard: [atomic.friendlyTarget.uid] });
  assert.equal(paid.ok, false);
  assert.equal(JSON.stringify(atomic.state), beforeUnpayable);
});

test("declining is free, and unsupported full-text variants remain uncompiled", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const declined = decide(f, { accept: false, actionId: "decline-retire-cost" });
  assert.equal(declined.ok, true);
  assert.equal(f.state.players.human.rear[0], f.friendlyTarget);
  assert.deepEqual(f.state.players.human.drop, []);
  assert.equal(f.state.pendingAttack.power, Number(f.source.power));

  const compiled = new Set(IDS);
  const candidates = catalog.flatMap(card => Engine.parseCardAbilities(card).filter(ability => ability.kind === "AUTO" &&
    /\[[^\]]*choose one of your (?:other )?rear-guards?, and retire it[^\]]*\]/i.test(ability.printedText || "")));
  assert.equal(candidates.length, 25, "all current AUTO bracket-cost catalog records are audited");
  assert.deepEqual(new Set(candidates.filter(ability => ability.definition?.source?.patternId === "auto-vanguard-attack-retire-friendly-rearguard-cost-battle-modifier-v1").map(ability => ability.id)), compiled);
  for (const ability of candidates.filter(item => !compiled.has(item.id))) {
    assert.equal(ability.choiceStatus, "needs-review", ability.id);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, false, ability.id);
  }
});
