"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-2526", "cfa-2538", "cfa-2678", "cfa-2691", "cfa-3033"];
const TEXT = "AUTO [VC/RC]: When this unit is attacked, this unit gets power +5000 until the end of that battle.";
const PATTERN = "auto-attacked-source-battle-power-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(id, uid, playerId, extra = {}) {
  const row = catalog.find(item => item.id === id) || {};
  return { uid, cardId: id, cardName: row.name || id, type: row.type || "Unit", grade: Number(row.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId = IDS[0], defenderSide = "bot", targetZone = "vanguard") {
  const row = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const defenderId = defenderSide === "human" ? "host-player" : "guest-player";
  const attackerId = defenderSide === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(cardId, `defender-${n}`, defenderId), attacker = card("cfa-3", `attacker-${n}`, attackerId);
  const vanguard = card("cfa-3", `vg-${n}`, defenderId), opponentVanguard = attacker;
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[defenderSide].vanguard = vanguard;
  players[attackerSide].vanguard = opponentVanguard;
  let target;
  if (targetZone === "vanguard") target = players[defenderSide].vanguard = source;
  else { source.circle = targetZone; const index = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"].indexOf(targetZone); assert.ok(index >= 0); players[defenderSide].rear[index] = source; target = source; }
  const battleId = `attacked-source-${n}`;
  const state = { matchId: "attacked-source-battle-power", stateVersion: 2, eventSequence: 0, turn: 3, side: attackerSide, phase: 5,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players, pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide, attackerPlayerId: attackerId, attackerZone: "vanguard",
      defenderSide, targetUid: target.uid, targetZone, guardCards: [], power: 18000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "attack.declared", actingPlayerId: attackerId, turnPlayerId: attackerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId, sourceControllerPlayerId: attacker.controllerPlayerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: target.ownerPlayerId, subjectControllerPlayerId: target.controllerPlayerId,
    currentLocation: targetZone, targetCardInstanceIds: [target.uid], targetLocation: targetZone,
    attackingUnitInstanceId: attacker.uid, attackingCardInstanceIds: [attacker.uid], battleId,
    phase: "battle", timingWindow: "attack-declared" });
  return { state, ability, source, target, attacker, event, defenderSide, attackerSide, defenderId, attackerId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, auth = f.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-attacked-source-${f.source.uid}`,
    expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("five exact VC/RC attacked-unit abilities have one source-matched +5000 battle effect", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${id}:0`);
    assert.ok(row, id);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"], id);
    assert.equal(ability.trigger.eventType, "attack.declared", id);
    assert.equal(ability.trigger.subject, "event-subject", id);
    assert.deepEqual(ability.effects, [{ op: "modify-defending-source-power", target: "source", amount: 5000, duration: "battle" }], id);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(id).filter(item => item.source?.patternId === PATTERN);
    assert.equal(trusted.length, 1, id);
    assert.equal(trusted[0].id, `${id}:0`, id);
    assert.equal(trusted[0].printedText, TEXT, id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("the host or joining player's exact unit gains battle power when the opponent attacks it", () => {
  for (const id of IDS) for (const defenderSide of ["human", "bot"]) for (const targetZone of ["vanguard", "rear-left"]) {
    const f = fixture(id, defenderSide, targetZone);
    assert.equal(discover(f).queued.length, 1, `${id}/${defenderSide}/${targetZone}`);
    assert.equal(f.state.pendingAbility.side, defenderSide);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${id}/${defenderSide}/${targetZone}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.targetPower, 15000);
  }
});

test("wrong target/source/battle/controller and host proxy do not activate or resolve the ability", () => {
  for (const change of [
    { subjectCardInstanceId: "other", cardInstanceId: "other", targetCardInstanceIds: ["other"] },
    { sourceCardInstanceId: "other", attackingUnitInstanceId: "other" },
    { targetLocation: "rear-right" },
    { sourceControllerPlayerId: "guest-player" }
  ]) {
    const f = fixture();
    const bad = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, bad).queued.length, 0, JSON.stringify(change));
  }

  const stale = fixture(); stale.state.pendingAttack.battleId = "other-battle";
  assert.equal(discover(stale).queued.length, 0);

  const wrongAttacker = fixture();
  wrongAttacker.state.pendingAttack.attackerSide = wrongAttacker.defenderSide;
  wrongAttacker.state.pendingAttack.attackerPlayerId = wrongAttacker.defenderId;
  wrongAttacker.state.side = wrongAttacker.defenderSide;
  assert.equal(discover(wrongAttacker).queued.length, 0);

  const joined = fixture(IDS[0], "bot");
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state);
  assert.equal(resolve(joined, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(joined.state), before);

  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("+5000", "+10000"); },
    ability => { ability.trigger.subject = "source"; },
    ability => { ability.requiredLocation = ["guardian"]; },
    ability => { ability.definition.effects[0].duration = "turn"; },
    ability => { ability.definition.id = "cfa-2538:0"; }
  ]) {
    const forged = structuredClone(joined.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
