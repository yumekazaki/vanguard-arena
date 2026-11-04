"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-rc-source-soul-grant-friendly-boost-turn-v1";
const IDS = Object.freeze(["cfa-4622:1", "cfa-4628:1"]);
const catalog = loadCatalog();
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(card, side = "human") {
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${card.id} has its exact ACT definition`);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${card.id}-${side}`, cardId: String(card.id), cardName: card.name, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left", grade: 0 };
  const target = { uid: `target-${card.id}-${side}`, cardId: "cfa-13", cardName: "Black Sage, Charon", type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-right", grade: 1 };
  const player = { playerId, vanguard: { uid: `vg-${side}`, cardId: "cfa-13", ownerPlayerId: playerId, controllerPlayerId: playerId }, rear: [source, target, null, null, null], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: { uid: `opp-vg-${side}`, cardId: "cfa-13", ownerPlayerId: opponentId, controllerPlayerId: opponentId }, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const state = { matchId: `source-soul-boost-${card.id}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } };
  return { ability, state, source, target, side, player };
}

function activate(f, targetUid, actionId = `activate-${f.source.uid}`) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { targetUid, costSelections: {} } }
  }, seats, Engine);
}

test("the exact Plasgal and Ringer Paprika ACT abilities compile as source-to-Soul target Boost grants", () => {
  assert.equal(Array.from(family, item => item.ability.id).sort().join(","), [...IDS].sort().join(","));
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id));
    assert.equal(ability.kind, "ACT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.equal(ability.once, false);
    assert.equal(ability.definition.effects.length, 1);
    assert.deepEqual(ability.definition.effects[0], { op: "grant-temporary-boost", target: "chosen", duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true } });
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player can pay the source-to-Soul cost and independently grant Boost to a friendly unit", () => {
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const f = fixture(card, side);
    const result = activate(f, f.target.uid);
    assert.equal(result.ok, true, `${card.name} / ${side}: ${result.reason}`);
    assert.equal(f.player.rear[0], null);
    assert.equal(f.player.soul.at(-1).uid, f.source.uid);
    assert.equal(f.target.boostAbility, true);
    assert.equal(f.target.temporaryBoostAbility, true);
    assert.equal(f.target.temporaryBoostAbilityExpiry, f.player.playerId);
    assert.equal(result.state.players[side === "human" ? "bot" : "human"].soul.length, 0);
    Engine.expireTurnModifiers(result.state.players, f.player.playerId);
    assert.equal(f.target.boostAbility, undefined, "the temporary keyword expires at the controller's turn end");
    assert.equal(f.target.temporaryBoostAbility, undefined);
  }
});

test("the target may be the controller's vanguard, and a printed Boost keyword survives the temporary grant", () => {
  const f = fixture(family[0].card);
  f.target.boostAbility = true;
  f.state.players.human.rear[1] = null;
  f.state.players.human.vanguard.boostAbility = true;
  const result = activate(f, f.state.players.human.vanguard.uid);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.players.human.vanguard.temporaryBoostAbility, true);
  Engine.expireTurnModifiers(result.state.players, "host-player");
  assert.equal(f.state.players.human.vanguard.boostAbility, true, "a keyword the unit already had remains after expiry");
  assert.equal(f.state.players.human.vanguard.temporaryBoostAbility, undefined);
});

test("illegal targets are rejected before cost payment", () => {
  const card = family[0].card;
  for (const targetKind of ["source", "opponent", "missing"]) {
    const f = fixture(card);
    const targetUid = targetKind === "source" ? f.source.uid : targetKind === "opponent" ? f.state.players.bot.vanguard.uid : undefined;
    const result = activate(f, targetUid);
    assert.equal(result.ok, false, targetKind);
    assert.equal(f.state.players.human.rear[0].uid, f.source.uid, `${targetKind}: source stays on RC`);
    assert.equal(f.state.players.human.soul.length, 0, `${targetKind}: cost was not paid`);
  }
});

test("ACT timing and Rear-Guard location are enforced, and an already used source cannot pay twice", () => {
  const f = fixture(family[0].card);
  f.state.phase = 3;
  assert.equal(activate(f, f.target.uid).reason, "wrong-timing-window");
  f.state.phase = 4;
  f.state.players.human.rear[0] = null;
  f.state.players.human.vanguard = f.source;
  f.source.circle = "vanguard";
  assert.equal(activate(f, f.target.uid).reason, "activation-wrong-zone");

  const used = fixture(family[0].card);
  assert.equal(activate(used, used.target.uid).ok, true);
  const retry = Reducer.applyManualAbilityActivation(used.state, {
    actorAuthUid: seats.hostAuthUid,
    actionId: "activate-the-same-source-again",
    expectedStateVersion: used.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: used.source.uid, abilityId: used.ability.id, selection: { targetUid: used.target.uid, costSelections: {} } }
  }, seats, Engine);
  assert.equal(retry.ok, false);
});

test("granting Boost repeatedly in one turn keeps the original keyword state for cleanup", () => {
  const f = fixture(family[0].card);
  const second = { ...fixture(family[1].card).source, uid: "second-source", circle: "rear-back-left" };
  f.state.players.human.rear[2] = second;
  assert.equal(activate(f, f.target.uid).ok, true);
  const secondAbility = Engine.parseCardAbilitiesCached(family[1].card).find(item => item.definition?.source?.patternId === PATTERN);
  const result = Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: seats.hostAuthUid,
    actionId: "second-source-grants-boost",
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: second.uid, abilityId: secondAbility.id, selection: { targetUid: f.target.uid, costSelections: {} } }
  }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  Engine.expireTurnModifiers(result.state.players, "host-player");
  assert.equal(f.target.boostAbility, undefined, "the second grant does not accidentally make Boost permanent");
});
