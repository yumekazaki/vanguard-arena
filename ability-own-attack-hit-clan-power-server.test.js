"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-255", ["Dimension Police", 3000]],
  ["cfa-1368", ["Aqua Force", 3000]],
  ["cfa-1746", ["Royal Paladin", 3000]],
  ["cfa-1800", ["Gold Paladin", 3000]],
  ["cfa-1902", ["Shadow Paladin", 3000]]
]);
const cards = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function setup(side) {
  const ownerId = side === "bot" ? "guest" : "host", enemyId = side === "bot" ? "host" : "guest", cardId = "cfa-255", clan = FAMILY.get(cardId)[0];
  const source = { uid: `attacker-${side}`, cardId, ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan, clans: [clan], unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-left", grade: 1, turnPowerBoost: 0 };
  const ally = { uid: `ally-${side}`, cardId: `ally-${side}`, ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan, clans: [clan], unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-right", grade: 1, turnPowerBoost: 0 };
  const wrongClan = { uid: `wrong-clan-${side}`, cardId: "wrong", ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: "Kagero", clans: ["Kagero"], unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-back-left", grade: 1, turnPowerBoost: 0 };
  const own = { playerId: ownerId, vanguard: { uid: `own-vg-${side}`, cardId: "own-vg", ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan, clans: [clan], unitCard: true, type: "Normal Unit", grade: 3 }, rear: [source, ally, wrongClan], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], orders: [], gZone: [] };
  const opponent = { playerId: enemyId, vanguard: { uid: `opp-vg-${side}`, cardId: "opp-vg", ownerPlayerId: enemyId, controllerPlayerId: enemyId, clan: "Kagero", clans: ["Kagero"], unitCard: true, type: "Normal Unit", grade: 3 }, rear: [], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], orders: [], gZone: [] };
  const state = { matchId: `hit-clan-power-${side}`, stateVersion: 3, eventSequence: 0, processedAbilityTriggers: [], side, turn: 4, phase: 5, players: side === "bot" ? { human: opponent, bot: own } : { human: own, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
  const hit = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, subjectCardInstanceId: opponent.vanguard.uid, subjectOwnerPlayerId: enemyId, subjectControllerPlayerId: enemyId, targetCardInstanceIds: [opponent.vanguard.uid], targetLocation: "vanguard", battleId: `battle-${side}`, timingWindow: "attack-hit" });
  return { state, source, ally, wrongClan, opponent, hit, clan, ownerId };
}

test("five exact own-attack-hit abilities preserve the attacker, Vanguard target, printed clan, and +3000 choice", () => {
  const audit = auditCatalog(cards);
  for (const [cardId, [clan, amount]] of FAMILY) {
    const card = cards.find(item => item.id === cardId), ability = Engine.parseCardAbilitiesCached(card)[0], definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === ability.id);
    assert.ok(definition, `${ability.id} is registered`);
    assert.equal(definition.source.patternId, "auto-rc-own-attack-hit-clan-power-turn-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: [] });
    assert.deepEqual(definition.effects, [{ op: "modify-power-target", target: "chosen", amount, duration: "turn", noOpIfNoLegalTargets: true, targetFilter: { controller: "source-controller", cardType: "unit", clan } }]);
    assert.equal(ability.choiceStatus, "modeled");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  assert.equal(audit.patterns["auto-rc-own-attack-hit-clan-power-turn-v1"], FAMILY.size);
  assert.deepEqual(audit.invalidCompiled, []);
});

test("both seats receive and resolve only their own exact Rear-Guard hit prompt and clan target choice", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup(side), { state, source, ally, wrongClan, hit, clan, ownerId } = fixture;
    const queued = Reducer.discoverAutoTriggers(state, [hit], Engine);
    assert.equal(queued.queued.length, 1);
    assert.equal(state.pendingAbility.side, side);
    assert.equal(state.pendingAbility.instance.uid, source.uid);
    assert.equal(state.pendingAbility.triggerControllerPlayerId, ownerId);
    const result = Reducer.applyAbilityDecision(state, { actorAuthUid: side === "bot" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `resolve-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: `${source.cardId}:0`, targetUid: ally.uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(ally.turnPowerBoost, 3000);
    assert.equal(ally.turnPowerExpiry, ally.controllerPlayerId);
    assert.equal(wrongClan.turnPowerBoost, 0);
    assert.equal(state.players[side === "bot" ? "human" : "bot"].vanguard.turnPowerBoost || 0, 0);
  }
});

test("another source, a Rear-Guard hit, and an illegal target cannot satisfy or resolve the AUTO", () => {
  const fixture = setup("bot"), { state, source, ally, wrongClan, hit } = fixture;
  const wrongSourceHit = Engine.createGameEvent(state, { ...hit, eventId: "other-source-event", sourceCardInstanceId: "other-attacker", subjectCardInstanceId: state.players.human.vanguard.uid, targetCardInstanceIds: [state.players.human.vanguard.uid] });
  assert.equal(Reducer.discoverAutoTriggers(state, [wrongSourceHit], Engine).queued.length, 0);
  const wrongTargetHit = Engine.createGameEvent(state, { ...hit, eventId: "rear-guard-target-event", sourceCardInstanceId: source.uid, subjectCardInstanceId: "opponent-rear", targetCardInstanceIds: ["opponent-rear"], targetLocation: "rear-guard" });
  assert.equal(Reducer.discoverAutoTriggers(state, [wrongTargetHit], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(state, [hit], Engine).queued.length, 1);
  const response = Reducer.applyAbilityDecision(state, { actorAuthUid: seats.guestAuthUid, actionId: "illegal-target", expectedStateVersion: state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: `${source.cardId}:0`, targetUid: wrongClan.uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
  assert.equal(response.ok, false);
  assert.equal(ally.turnPowerBoost, 0);
  assert.equal(wrongClan.turnPowerBoost, 0);
});
