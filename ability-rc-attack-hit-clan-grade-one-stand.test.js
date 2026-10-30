"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([["cfa-214", "Gold Paladin"], ["cfa-306", "Great Nature"], ["cfa-377", "Neo Nectar"]]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function card(uid, cardId, ownerPlayerId, extra = {}) { return { uid, cardId, ownerPlayerId, controllerPlayerId: ownerPlayerId, type: "Unit", ...extra }; }
function fixture(cardId = "cfa-214", side = "human", options = {}) {
  const clan = FAMILY.get(cardId), ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest-player" : "host-player";
  const source = card("attacker", cardId, ownerId, { clan, clans: [clan], grade: 2, name: "Source Rear-Guard" });
  const target = card("target", "target", ownerId, { clan: options.targetClan || clan, clans: [options.targetClan || clan], grade: options.targetGrade ?? 1, rested: true, name: "Eligible Rear-Guard" });
  const opponentVanguard = card("opponent-vanguard", "opp-vg", opponentId, { clan: "Kagero", grade: 3, name: "Opponent Vanguard" });
  const damage = Array.from({ length: options.faceUpDamage ?? 2 }, (_, i) => card(`damage-${i}`, `damage-${i}`, ownerId, { faceDown: false }));
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = card(`${side}-vg`, "vg", ownerId, { clan, grade: 3, name: "Friendly Vanguard" });
  players[side].rear[0] = source; players[side].rear[1] = options.targets === false ? null : target; players[side].damage = damage;
  players[opponentSide].vanguard = opponentVanguard;
  const state = { matchId: "rc-hit-grade-stand", stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players, pendingAttack: { battleId: "rc-hit-battle", closing: true, attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid, attackerZone: "rear-left", defenderSide: opponentSide, targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: 1 } };
  const ability = Engine.parseCardAbilitiesCached(catalog.find(c => c.id === cardId)).find(a => a.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 compiles`);
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId, cardInstanceId: opponentVanguard.uid, subjectCardInstanceId: opponentVanguard.uid, subjectOwnerPlayerId: opponentId, subjectControllerPlayerId: opponentId,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid, battleId: "rc-hit-battle", phase: "battle", timingWindow: "attack-hit" });
  return { state, ability, source, target, damage, side, ownerId, event, clan, opponentVanguard };
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decide(f, { targetUid = f.target?.uid, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, cbUids = f.damage.slice(0, 2).map(c => c.uid), accept = true } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `rc-hit-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid, costSelections: { cb: cbUids } } } }, seats, Engine);
}

test("three exact RC attack-hit abilities preserve source, clan, Grade 1 cap, cost, and stand effect", () => {
  for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition.source.patternId, "auto-rc-own-attack-hit-clan-grade-one-stand-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 2 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "stand-target", target: "chosen", allowAlreadyStanding: true, noOpIfNoLegalTargets: true, targetFilter: { controller: "source-controller", cardType: "unit", zone: "rear-guard", clan, maxGrade: 1 } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player resolve only their own Rear-Guard hit and pay their own Counter Blast", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-214", side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.target.rested, false);
    assert.equal(f.damage.filter(c => c.faceDown).length, 2);
    assert.ok(result.events.some(e => e.type === "unit.stood" && e.cardInstanceId === f.target.uid));
  }
});

test("wrong attacker, target grade or clan, missing cost, stale battle, and host proxy reject without partial payment", () => {
  const wrongSource = fixture(); wrongSource.event = { ...wrongSource.event, sourceCardInstanceId: "other", attackingUnitInstanceId: "other" };
  assert.equal(discover(wrongSource).queued.length, 0);
  const highGrade = fixture("cfa-306", "human", { targetGrade: 2 });
  assert.equal(discover(highGrade).queued.length, 1);
  assert.equal(decide(highGrade).ok, false);
  const wrongClan = fixture("cfa-377", "human", { targetClan: "Kagero" });
  assert.equal(discover(wrongClan).queued.length, 1);
  assert.equal(decide(wrongClan).ok, false);
  const short = fixture("cfa-214", "bot", { faceUpDamage: 1 });
  assert.equal(discover(short).queued.length, 0);
  const stale = fixture("cfa-306", "bot"); assert.equal(discover(stale).queued.length, 1); stale.state.pendingAttack.battleId = "other";
  assert.equal(decide(stale).ok, false);
  const proxy = fixture("cfa-377", "bot"); assert.equal(discover(proxy).queued.length, 1);
  const before = proxy.damage.map(c => c.faceDown);
  assert.equal(decide(proxy, { authUid: seats.hostAuthUid }).ok, false);
  assert.deepEqual(proxy.damage.map(c => c.faceDown), before);
});

test("declining does not pay, and tampered printed identity is not trusted", () => {
  const f = fixture("cfa-214"); assert.equal(discover(f).queued.length, 1);
  assert.equal(decide(f, { accept: false }).ok, true);
  assert.equal(f.damage.filter(c => c.faceDown).length, 0);
  assert.equal(f.target.rested, true);
  const forged = { ...f.ability, definition: { ...f.ability.definition, printedText: f.ability.definition.printedText.replace("Gold Paladin", "Genesis") } };
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
