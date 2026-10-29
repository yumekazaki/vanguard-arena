"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-source-to-soul-choose-friendly-power-turn-v1";
const catalog = loadCatalog();
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(card, side) {
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${card.id} has the exact source-to-Soul ACT`);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${card.id}-${side}`, cardId: String(card.id), cardName: card.name, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left", grade: Number(card.grade || 0) };
  const target = { uid: `target-${card.id}-${side}`, cardId: "cfa-3", cardName: "Friendly Unit", type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-right", grade: 1, turnPowerBoost: 0 };
  const player = { playerId, vanguard: { uid: `vg-${side}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId }, rear: [source, target, null, null, null], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: { uid: `opp-vg-${side}`, cardId: "cfa-3", ownerPlayerId: opponentId, controllerPlayerId: opponentId }, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const state = { matchId: `source-to-soul-${card.id}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } };
  return { ability, state, source, target, side };
}

test("all 31 exact source-to-Soul ACT definitions are trusted and retain their source-only payment and printed power", () => {
  assert.equal(family.length, 31);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), `${ability.id} is in the production registry`);
    assert.equal(ability.kind, "ACT", ability.id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], ability.id);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true } }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("host and joining player independently pay each exact source-to-Soul ACT and resolve the printed power", () => {
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const f = fixture(card, side);
    const result = Reducer.applyManualAbilityActivation(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `resolve-${card.id}-${side}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ability.id, selection: { targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${card.id} ${side}: ${result.reason}`);
    assert.equal(f.state.players[side].rear.includes(f.source), false, `${card.id} ${side} source leaves RC`);
    assert.equal(f.state.players[side].soul.at(-1).uid, f.source.uid, `${card.id} ${side} pays its exact source`);
    assert.equal(f.target.turnPowerBoost, ability.definition.effects[0].amount, `${card.id} ${side} power`);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].soul.length, 0);
  }
});
