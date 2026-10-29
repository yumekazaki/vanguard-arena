"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-legacy-limit-break-vanguard-attack-power-v1";
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId, side, damageCount) {
  const card = cards.get(String(cardId));
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} has its Limit Break attack ability`);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `limit-break-source-${cardId}-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, power: Number(card.power || 10000) };
  const target = { uid: `limit-break-target-${side}`, cardId: "cfa-3", ownerPlayerId: opponentId, controllerPlayerId: opponentId, grade: 3, power: 13000 };
  const own = { playerId, vanguard: source, rear: Array(5).fill(null), damage: Array.from({ length: damageCount }, (_, i) => ({ uid: `damage-${side}-${i}`, cardId: "cfa-4", ownerPlayerId: playerId, controllerPlayerId: playerId })), hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: target, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const state = { matchId: `limit-break-${cardId}-${side}-${damageCount}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], processedEventIds: [], pendingAbilities: [], pendingAbility: null, pendingAttack: { battleId: `battle-${cardId}-${side}`, attackerSide: side, attackerUid: source.uid, attackerZone: "vanguard", defenderSide: side === "human" ? "bot" : "human", targetUid: target.uid, targetZone: "vanguard", power: Number(card.power || 10000), targetPower: 13000 }, turn: 2, side, phase: 5, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    attackingCardInstanceIds: [source.uid], targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, source, ability, event, side, playerId };
}

test("all 35 exact legacy Limit Break attack definitions are in the production registry", () => {
  assert.equal(family.length, 35);
  for (const { card, ability } of family) {
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(card.id).find(item => item.id === ability.id);
    assert.ok(trusted, `${ability.id} is trusted for authoritative play`);
    assert.deepEqual(trusted.conditions, [{ type: "limit-break-active", count: 4 }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("Limit Break attack AUTO matches its own Vanguard, requires four damage, and resolves for either player", () => {
  for (const cardId of ["cfa-218", family.find(item => item.ability.printedText.includes("Limit Break 4:"))?.card.id].filter(Boolean)) {
    for (const side of ["human", "bot"]) {
      const inactive = fixture(cardId, side, 3);
      assert.equal(Reducer.discoverAutoTriggers(inactive.state, [inactive.event], Engine).queued.length, 0, `${cardId} ${side} below threshold`);
      const legal = fixture(cardId, side, 4);
      assert.equal(Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine).queued.length, 1, `${cardId} ${side} at threshold`);
      assert.equal(legal.state.pendingAbility.side, side);
      assert.equal(legal.state.pendingAbility.instance.uid, legal.source.uid);
      const result = Reducer.applyAbilityDecision(legal.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
        actionId: `resolve-${cardId}-${side}`, expectedStateVersion: legal.state.stateVersion,
        payload: { accept: true, selection: { instanceUid: legal.source.uid, abilityId: legal.ability.id } } }, seats, Engine);
      assert.equal(result.ok, true, `${cardId} ${side}: ${result.reason}`);
      assert.equal(legal.state.pendingAttack.power, Number(legal.state.players[side].vanguard.power || 10000) + legal.ability.definition.effects[0].amount);
    }
  }
});
