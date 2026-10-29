"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const targets = [
  ["cfa-131", "King of Sword", "cfa-147", "unit"], ["cfa-369", "Iris Knight", "cfa-373", "card"],
  ["cfa-462", "Blue Dust", "cfa-467", "unit"], ["cfa-514", "Chain-attack Sutherland", "cfa-528", "unit"],
  ["cfa-522", "Wyvern Strike, Tejas", "cfa-539", "card"], ["cfa-661", "Blaster Blade", "cfa-664", "card"]
];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;
function rowFor(id) { return catalog.find(row => String(row.id) === String(id)); }
function card(uid, id, playerId) {
  const row = rowFor(id);
  return { uid, cardId: String(id), cardName: row?.name || "Test Unit", type: "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(sourceId = targets[0][0], side = "human", targetId = targets.find(row => row[0] === sourceId)[2]) {
  const row = rowFor(sourceId), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${sourceId}:0`);
  assert.ok(ability, `compiled exact ability ${sourceId}:0`);
  const targetName = targets.find(item => item[0] === sourceId)[1], opponent = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(`named-booster-${n}`, sourceId, ownerId), attacker = card(`named-target-${n}`, targetId, ownerId), defender = card(`defender-${n}`, "cfa-3", opponentId);
  source.rested = true;
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = attacker; players[side].rear[0] = source; players[opponent].vanguard = defender;
  const battleId = `named-boost-${n}`;
  const state = { matchId: "named-boost-power", stateVersion: 1, eventSequence: 0, turn: 2, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: "vanguard", targetUid: defender.uid, targetZone: "vanguard", defenderSide: opponent, power: 18000, targetPower: 10000, critical: 1, boostUid: source.uid, boostPower: 5000 } };
  const event = Engine.createGameEvent(state, { type: "unit.boosted", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid, boostedCardName: targetName,
    previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left", targetLocation: "vanguard", targetCardInstanceIds: [attacker.uid],
    battleId, phase: "battle", timingWindow: "boost-step", after: { rested: true } });
  return { state, ability, event, source, attacker, targetName, side, ownerId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-named-boost-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("six exact catalog named-booster abilities preserve their target name and battle power", () => {
  for (const [id, name, , kind] of targets) {
    const row = rowFor(id), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${id}:0`);
    assert.ok(row, id); assert.equal(ability.definition.source.patternId, "auto-boosts-named-unit-power-battle-v1", id);
    assert.match(ability.printedText, new RegExp(`When this unit boosts a ${kind} named \\"${name}\\", the boosted unit gets power \\+4000`), id);
    assert.equal(ability.trigger.boostedUnitName, name, id);
    assert.deepEqual(ability.effects, [{ op: "modify-power-target", target: "boosted-unit", amount: 4000, duration: "battle", targetFilter: { controller: "source-controller", cardType: "unit", cardName: name } }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(id).filter(item => item.id === ability.id).length, 1, id);
  }
});

test("only the exact named boosted unit qualifies, with its booster controller resolving the effect", () => {
  for (const [id, , targetId] of targets) for (const side of ["human", "bot"]) {
    const f = fixture(id, side, targetId);
    assert.equal(discover(f).queued.length, 1, `${id}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid).ok, false, "opponent cannot proxy the source controller");
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 22000);
  }
});

test("a different boosted name, source, battle, or forged server definition never qualifies", () => {
  const f = fixture();
  for (const change of [
    { boostedCardName: "Different Unit" },
    { boosterCardInstanceId: "other", sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" },
    { boostedCardInstanceId: "other", targetCardInstanceIds: ["other"] },
    { battleId: "stale-battle" }, { timingWindow: "attack-declared" }
  ]) {
    const event = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(change));
  }
  const mismatchedTarget = fixture(targets[0][0], "human", "cfa-3");
  assert.equal(discover(mismatchedTarget).queued.length, 0, "authoritative target definition must match the printed name");
  const forged = structuredClone(f.ability); forged.definition.effects[0].targetFilter.cardName = "Different Unit";
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
