"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-1075";
const ABILITY_ID = `${CARD_ID}:0`;
const PATTERN_ID = "auto-own-attack-hit-counter-blast-retire-front-row-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => String(card.id) === CARD_ID);
let sequence = 0;

function card(uid, cardId, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Test unit", name: definition?.name || "Test unit",
    type: definition?.type || "Unit", grade: definition?.grade ?? 0, ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: true, ...extra };
}

function fixture({ side = "human", sourceZone = "vanguard", eradicatorVanguard = true, faceUpDamage = 2, target = true, targetZone = "rear-left" } = {}) {
  const id = ++sequence, sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human", opponentPlayerId = side === "human" ? "guest-player" : "host-player";
  const source = card(`susei-${id}`, CARD_ID, sourcePlayerId);
  const player = playerId => ({ playerId, vanguard: null, rear: Array(6).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const sourceCircle = sourceZone === "vanguard" ? "vanguard" : sourceZone;
  if (sourceZone === "vanguard") players[side].vanguard = source;
  else { players[side].rear[sourceZone === "accel-1" ? 5 : 0] = source; if (sourceZone === "accel-1") players[side].accelZones = 1; }
  if (sourceZone !== "vanguard") players[side].vanguard = card(`own-vg-${id}`, eradicatorVanguard ? "cfa-1070" : "cfa-3", sourcePlayerId);
  const targetVanguard = card(`opponent-vg-${id}`, "cfa-3", opponentPlayerId, { grade: 3 });
  players[opponentSide].vanguard = targetVanguard;
  const frontTarget = target ? card(`front-target-${id}`, "cfa-10069", opponentPlayerId) : null;
  if (frontTarget) players[opponentSide].rear[targetZone === "accel-1" ? 5 : targetZone === "rear-right" ? 1 : 0] = frontTarget;
  const damage = Array.from({ length: faceUpDamage }, (_, index) => card(`damage-${id}-${index + 1}`, "cfa-1", sourcePlayerId, { faceDown: false }));
  players[side].damage = damage;
  const battleId = `susei-battle-${id}`;
  const state = { matchId: `susei-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId, closing: true, attackerSide: side, attackerPlayerId: sourcePlayerId, attackerUid: source.uid, attackerZone: sourceCircle,
      defenderSide: opponentSide, targetUid: targetVanguard.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: 1 } };
  const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);
  assert.ok(ability, "the official Susei ability compiles from the catalog");
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: targetVanguard.uid, subjectCardInstanceId: targetVanguard.uid, subjectOwnerPlayerId: opponentPlayerId, subjectControllerPlayerId: opponentPlayerId,
    targetCardInstanceIds: [targetVanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid,
    currentLocation: sourceCircle, previousLocation: sourceCircle, battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, event, source, ability, targetVanguard, frontTarget, damage, side, opponentSide, sourcePlayerId, opponentPlayerId, sourceCircle, battleId };
}

function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }
function resolve(game, accept, { actorAuthUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, targetUid = game.frontTarget?.uid,
  cb = game.damage.slice(0, 2).map(item => item.uid), actionId = `resolve-${game.battleId}-${accept}` } = {}) {
  return Reducer.applyAbilityDecision(game.state, { actorAuthUid, actionId, expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: game.source.uid, abilityId: ABILITY_ID, targetUid,
      costSelections: { cb, sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test("official Susei text compiles as an optional exact VC/RC attack-hit ability", () => {
  assert.equal(cardDefinition?.name, "Assassin Sword Eradicator, Susei");
  const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);
  assert.match(ability.printedText, /^AUTO \[VC\/RC\]: \[Counter Blast 2\]/);
  assert.equal(ability.definition.source.patternId, PATTERN_ID);
  assert.equal(ability.definition.source.officialCardNumber, "TD09/006EN");
  assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(ability.trigger.eventType, "attack.hit");
  assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-name-contains", value: "Eradicator" }]);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2 }]);
  assert.equal(ability.canDecline, true);
  assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player resolve only their exact VC or RC attack that hits the opponent Vanguard", () => {
  for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-left", "accel-1"]) {
    const game = fixture({ side, sourceZone, targetZone: "rear-right" });
    const queued = discover(game);
    assert.equal(queued.queued.length, 1, `${side}/${sourceZone}: ${JSON.stringify(queued)}`);
    assert.equal(game.state.pendingAbility.side, side);
    assert.equal(game.state.pendingAbility.instance.uid, game.source.uid);
    assert.equal(discover(game).queued.length, 0, "the attack-hit event cannot create a duplicate prompt");
    const result = resolve(game, true);
    assert.equal(result.ok, true, result.reason);
    assert.equal(game.damage[0].faceDown, true);
    assert.equal(game.damage[1].faceDown, true);
    assert.equal(game.state.players[side].damage.every(item => item.faceDown), true);
    assert.equal(game.state.players[game.opponentSide].rear[1], null);
    assert.equal(game.state.players[game.opponentSide].drop.some(item => item.uid === game.frontTarget.uid), true);
    assert.equal(game.state.players[game.opponentSide].drop.find(item => item.uid === game.frontTarget.uid).zone, "drop");
  }
});

test("Susei can choose an opponent Accel front-row Rear-Guard", () => {
  const game = fixture({ sourceZone: "rear-left", targetZone: "accel-1" });
  assert.equal(discover(game).queued.length, 1);
  const result = resolve(game, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(game.state.players.bot.rear[5], null);
  assert.equal(game.state.players.bot.drop.some(item => item.uid === game.frontTarget.uid), true);
});

test("wrong source, missing Eradicator Vanguard, non-Vanguard hit, and stale battle cannot prompt", () => {
  const otherSource = fixture({ sourceZone: "rear-left" });
  assert.equal(discover(otherSource, { ...otherSource.event, eventId: "wrong-source", sourceCardInstanceId: "other-unit", attackingUnitInstanceId: "other-unit" }).queued.length, 0);

  const condition = fixture({ sourceZone: "rear-left", eradicatorVanguard: false });
  assert.equal(discover(condition).queued.length, 0);

  const wrongTarget = fixture({ sourceZone: "rear-left" });
  wrongTarget.state.pendingAttack.targetZone = "rear-left";
  wrongTarget.state.pendingAttack.targetUid = wrongTarget.frontTarget.uid;
  const nonVanguardEvent = { ...wrongTarget.event, eventId: "non-vanguard-hit", cardInstanceId: wrongTarget.frontTarget.uid,
    subjectCardInstanceId: wrongTarget.frontTarget.uid, targetCardInstanceIds: [wrongTarget.frontTarget.uid], targetLocation: "rear-left" };
  assert.equal(discover(wrongTarget, nonVanguardEvent).queued.length, 0);

  const stale = fixture({ sourceZone: "rear-left" });
  stale.state.pendingAttack.battleId = "different-battle";
  assert.equal(discover(stale).queued.length, 0);
});

test("unpayable cost or no legal front-row target skips the optional ability", () => {
  const cost = fixture({ sourceZone: "rear-left", faceUpDamage: 1 });
  const costResult = discover(cost);
  assert.equal(costResult.queued.length, 0);
  assert.equal(costResult.skipped.some(item => item.reason === "unpayable-cost"), true);

  const target = fixture({ sourceZone: "rear-left", target: false });
  const targetResult = discover(target);
  assert.equal(targetResult.queued.length, 0);
  assert.equal(targetResult.skipped.some(item => item.reason === "no-legal-targets"), true);
});

test("declining pays nothing and a host cannot resolve the joining player's Susei", () => {
  const declined = fixture({ side: "bot", sourceZone: "rear-left" });
  assert.equal(discover(declined).queued.length, 1);
  const declineResult = resolve(declined, false);
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.damage.every(item => !item.faceDown), true);
  assert.equal(declined.state.players.bot.rear[0].uid, declined.source.uid);
  assert.equal(discover(declined).queued.length, 0);

  const joined = fixture({ side: "bot", sourceZone: "rear-left" });
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state);
  const forged = resolve(joined, true, { actorAuthUid: seats.hostAuthUid });
  assert.equal(forged.ok, false);
  assert.equal(JSON.stringify(joined.state), before);
});

test("invalid target, invalid Counter-Blast selection, and forged definition are rejected atomically", () => {
  const invalidTarget = fixture({ sourceZone: "rear-left" });
  assert.equal(discover(invalidTarget).queued.length, 1);
  const beforeTarget = JSON.stringify(invalidTarget.state);
  assert.equal(resolve(invalidTarget, true, { targetUid: invalidTarget.targetVanguard.uid }).ok, false);
  assert.equal(JSON.stringify(invalidTarget.state), beforeTarget);

  const invalidCost = fixture({ sourceZone: "rear-left" });
  assert.equal(discover(invalidCost).queued.length, 1);
  const beforeCost = JSON.stringify(invalidCost.state);
  assert.equal(resolve(invalidCost, true, { cb: [invalidCost.damage[0].uid] }).ok, false);
  assert.equal(JSON.stringify(invalidCost.state), beforeCost);

  const forged = structuredClone(Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID));
  forged.definition.effects[0].targetFilter.row = "back";
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
