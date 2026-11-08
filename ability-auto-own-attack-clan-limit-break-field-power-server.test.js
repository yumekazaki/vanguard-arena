"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-clan-limit-break-field-power-battle-v1";
const NEW_CARD_IDS = ["cfa-1248", "cfa-1255", "cfa-1374"];
const LIMIT_BREAK_VANGUARD = {
  "Aqua Force": "cfa-98",
  Etranger: "cfa-1201",
  "Angel Feather": "cfa-727"
};
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId, side = "human", sourceCircle = "rear-guard", condition = "matching") {
  const card = cards.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 has a structured definition`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}-${sourceCircle}`, cardId, cardName: card.name,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 8000 };
  const clan = card.clan;
  let supportingVanguardId = LIMIT_BREAK_VANGUARD[clan];
  if (condition === "wrong-clan") supportingVanguardId = "cfa-1201";
  const supportDefinition = cards.get(supportingVanguardId);
  const support = { uid: `lb-${cardId}-${side}-${condition}`, cardId: supportingVanguardId,
    cardName: supportDefinition.name, ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: true, grade: supportDefinition.grade, hasLimitBreak4: condition !== "no-limit-break" };
  const opponentVanguard = { uid: `opponent-vg-${cardId}-${side}`, cardId: "cfa-3", cardName: "Opponent Vanguard",
    ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3, power: 13000 };
  const ownVanguard = sourceCircle === "vanguard" ? source : support;
  const ownRear = Array(5).fill(null);
  if (sourceCircle === "rear-guard") ownRear[0] = source;
  else ownRear[0] = support;
  const own = { playerId, vanguard: ownVanguard, rear: ownRear, damage: [], hand: [], soul: [], drop: [],
    bind: [], deck: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: Array(5).fill(null), damage: [],
    hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [] };
  const battleId = `battle-${cardId}-${side}-${sourceCircle}`;
  const state = { matchId: `clan-limit-${cardId}-${side}-${sourceCircle}-${condition}`, stateVersion: 1,
    eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], processedEventIds: [], pendingAbilities: [],
    pendingAbility: null, side, phase: 5, turn: 2, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: playerId,
      attackerZone: sourceCircle === "vanguard" ? "vanguard" : "rear-left", defenderSide: side === "human" ? "bot" : "human",
      targetUid: opponentVanguard.uid, targetZone: "vanguard", power: source.power, critical: 1 } };
  const location = sourceCircle === "vanguard" ? "vanguard" : "rear-left";
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId, attackingCardInstanceIds: [source.uid], currentLocation: location,
    previousLocation: location, targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard",
    battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, event, ability, card, source, side, playerId, support, opponentVanguard };
}

function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-${f.ability.id}-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all 16 matching real catalog abilities have exact trusted source, clan condition, circle, and battle modifier", () => {
  assert.equal(family.length, 16);
  for (const { card, ability } of family) {
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(card.id).find(item => item.id === ability.id);
    assert.ok(trusted, `${ability.id} is registered for authoritative resolution`);
    assert.equal(ability.kind, "AUTO", ability.id);
    assert.equal(ability.trigger.eventType, "unit.attacked", ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.deepEqual(ability.conditions, [{ type: "controller-field-has-clan-limit-break", clan: card.clan, count: 4 }], ability.id);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("the three newly covered cards resolve their own attacks for the host and joining player from VC and RC", () => {
  for (const cardId of NEW_CARD_IDS) for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-guard"]) {
    const f = fixture(cardId, side, circle);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1,
      `${cardId} ${side} ${circle} should trigger`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId} ${side} ${circle}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, 11000);
    assert.equal(f.state.players[side].vanguard.uid, circle === "vanguard" ? f.source.uid : f.support.uid);
  }
});

test("another unit attacking or missing the controller's matching clan Limit Break unit does not trigger", () => {
  const unrelated = fixture("cfa-1248", "human", "rear-guard");
  unrelated.event = { ...unrelated.event, sourceCardInstanceId: "other-attacker", cardInstanceId: "other-attacker",
    subjectCardInstanceId: "other-attacker", attackingCardInstanceIds: ["other-attacker"] };
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0);

  for (const condition of ["wrong-clan", "no-limit-break"]) {
    const f = fixture("cfa-1248", "bot", "rear-guard", condition);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, condition);
  }

  const opponentOnly = fixture("cfa-1374", "human", "rear-guard");
  const controller = opponentOnly.state.players.human;
  opponentOnly.state.players.bot.vanguard = controller.vanguard;
  controller.vanguard = { uid: "wrong-controller-vg", cardId: "cfa-3", ownerPlayerId: "player-host",
    controllerPlayerId: "player-host", unitCard: true, grade: 3, hasLimitBreak4: false };
  assert.equal(Reducer.discoverAutoTriggers(opponentOnly.state, [opponentOnly.event], Engine).queued.length, 0,
    "an opponent's matching Limit Break unit cannot satisfy the controller's condition");
});

