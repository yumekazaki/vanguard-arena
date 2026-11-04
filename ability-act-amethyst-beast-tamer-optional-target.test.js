"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-3387";
const ABILITY_ID = `${CARD_ID}:0`;
const OFFICIAL_TEXT = "ACT [RC]: [Put this unit into your soul] Choose up to one of your units, and it gets power +3000 until end of turn.";
const OFFICIAL_REFERENCE = "https://en.cf-vanguard.com/cardlist/?cardno=G-TD07%2F019EN";
const card = loadCatalog().find(item => String(item.id) === CARD_ID);
const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === ABILITY_ID);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(side = "human", { includeTarget = true } = {}) {
  const actorId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}`, cardId: CARD_ID, cardName: card.name, type: "Trigger", unitCard: true, ownerPlayerId: actorId, controllerPlayerId: actorId, circle: "rear-left", grade: 0 };
  const target = includeTarget ? { uid: `target-${side}`, cardId: "cfa-3", cardName: "Friendly Unit", type: "Unit", unitCard: true, ownerPlayerId: actorId, controllerPlayerId: actorId, circle: "rear-right", grade: 1, turnPowerBoost: 0 } : null;
  const player = { playerId: actorId, vanguard: { uid: `vg-${side}`, cardId: "cfa-3", ownerPlayerId: actorId, controllerPlayerId: actorId }, rear: [source, target], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: { uid: `opp-vg-${side}`, cardId: "cfa-3", ownerPlayerId: opponentId, controllerPlayerId: opponentId }, rear: [], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  return {
    state: { matchId: `amethyst-optional-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } },
    source,
    target,
    actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid
  };
}

function activate(f, selection, actionId = `activate-${f.state.side}`) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: f.actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ABILITY_ID, selection }
  }, seats, Engine);
}

test("Amethyst Beast Tamer uses the official optional-target text and an exact optional-target definition", () => {
  assert.ok(card);
  assert.ok(ability);
  assert.equal(card.name, "Amethyst Beast Tamer");
  assert.equal(card.type, "Trigger");
  assert.equal(card.clan, "Pale Moon");
  assert.equal(card.grade, 0);
  assert.equal(card.power, 4000);
  assert.equal(card.shield, 10000);
  assert.equal(Engine.parseCardAbilitiesCached(card).length, 1, "whole card has exactly one printed ability");
  assert.ok(card.text.endsWith(OFFICIAL_TEXT), "the catalog's printed ability text matches the official source");
  assert.equal(ability.printedText, OFFICIAL_TEXT);
  assert.equal(ability.definition.printedText, OFFICIAL_TEXT);
  assert.equal(ability.definition.source.patternId, "act-source-to-soul-optional-up-to-one-friendly-power-v1");
  assert.equal(ability.definition.source.officialReference, OFFICIAL_REFERENCE);
  assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.equal(ability.definition.effects[0].optionalTarget, true);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player may choose a friendly unit or choose no target after paying the exact source cost", () => {
  for (const side of ["human", "bot"]) {
    const targeted = fixture(side);
    const targetResult = activate(targeted, { targetUid: targeted.target.uid }, `target-${side}`);
    assert.equal(targetResult.ok, true, `${side}: ${targetResult.reason}`);
    assert.equal(targeted.state.players[side].rear[0], null);
    assert.equal(targeted.state.players[side].soul.at(-1).uid, targeted.source.uid);
    assert.equal(targeted.target.turnPowerBoost, 3000);

    const skipped = fixture(side);
    const skipResult = activate(skipped, { optionalNoTarget: true }, `skip-${side}`);
    assert.equal(skipResult.ok, true, `${side}: ${skipResult.reason}`);
    assert.equal(skipped.state.players[side].rear[0], null);
    assert.equal(skipped.state.players[side].soul.at(-1).uid, skipped.source.uid);
    assert.equal(skipped.target.turnPowerBoost, 0);
  }
});

test("choosing up to one allows the player to choose no target even when legal units exist", () => {
  const noTarget = fixture("human", { includeTarget: false });
  const noTargetResult = activate(noTarget, { optionalNoTarget: true }, "choose-no-target");
  assert.equal(noTargetResult.ok, true, noTargetResult.reason);
  assert.equal(noTarget.state.players.human.soul.at(-1).uid, noTarget.source.uid);
  assert.equal(noTarget.state.players.human.vanguard.turnPowerBoost || 0, 0);
});

test("when no legal unit exists the effect resolves without a target, while an illegal target is rejected without paying", () => {
  const noTarget = fixture("human", { includeTarget: false });
  noTarget.state.players.human.vanguard = null;
  const noTargetResult = activate(noTarget, {}, "no-legal-unit");
  assert.equal(noTargetResult.ok, true, noTargetResult.reason);
  assert.equal(noTarget.state.players.human.soul.at(-1).uid, noTarget.source.uid);
  const invalid = fixture("human");
  const opponentUnit = { uid: "opponent-unit", cardId: "cfa-3", cardName: "Opponent Unit", type: "Unit", unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player", circle: "rear-left", grade: 1, turnPowerBoost: 0 };
  invalid.state.players.bot.rear[0] = opponentUnit;
  const before = JSON.stringify(invalid.state);
  const invalidResult = activate(invalid, { targetUid: opponentUnit.uid }, "invalid-opponent-target");
  assert.equal(invalidResult.ok, false);
  assert.equal(JSON.stringify(invalid.state), before);
});
