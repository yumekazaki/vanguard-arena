"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-source-to-soul-choose-friendly-power-turn-v1";
const EXPECTED_ABILITY_IDS = Object.freeze([
  "cfa-11635:0", "cfa-11638:0", "cfa-11732:1", "cfa-11758:0", "cfa-2208:1", "cfa-2552:1",
  "cfa-2997:0", "cfa-3403:0", "cfa-4069:0", "cfa-4351:0", "cfa-4454:0", "cfa-4467:0",
  "cfa-4530:0", "cfa-4788:0", "cfa-4895:0", "cfa-4983:0", "cfa-5041:0", "cfa-5084:0",
  "cfa-5088:0", "cfa-5218:0", "cfa-5292:0", "cfa-5309:0", "cfa-5315:0", "cfa-5481:0",
  "cfa-5485:0", "cfa-5608:0", "cfa-5618:0", "cfa-5748:0", "cfa-8319:0", "cfa-8572:0",
  "cfa-4731:0", "cfa-5052:0"
]);
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

test("all 32 required-target source-to-Soul ACT definitions are trusted and retain their exact source-only payment and printed power", () => {
  const actualIds = family.map(item => item.ability.id).sort();
  const expectedIds = [...EXPECTED_ABILITY_IDS].sort();
  assert.equal(actualIds.length, expectedIds.length);
  assert.equal(new Set(actualIds).size, actualIds.length);
  for (const abilityId of expectedIds) assert.ok(actualIds.includes(abilityId), `missing exact family ability ${abilityId}`);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), `${ability.id} is in the production registry`);
    assert.equal(ability.kind, "ACT", ability.id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], ability.id);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true } }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("the Howard the Ghostie and Battle Sister, Ganache word-order variants keep their catalog text and exact +3000 effect", () => {
  const expectedTexts = new Map([
    ["cfa-4731:0", "ACT [RC]: [Put this unit into your soul] Choose one of your units, it gets power +3000 until end of turn."],
    ["cfa-5052:0", "ACT [RC]: [Put this unit into your soul] Choose one of your units, and until end of turn, it gets power +3000."]
  ]);
  for (const [abilityId, printedText] of expectedTexts) {
    const { card, ability } = family.find(item => item.ability.id === abilityId) || {};
    assert.ok(card, `${abilityId} is a catalog match`);
    assert.equal(ability.printedText, printedText, `${abilityId} preserves the local catalog text`);
    assert.equal(ability.definition.effects[0].amount, 3000, `${abilityId} uses the printed modifier`);
    assert.equal(ability.definition.source.officialReference.includes(abilityId === "cfa-4731:0" ? "G-CHB03%2F059EN" : "G-BT12%2F060EN"), true, `${abilityId} links the correct official card`);
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

test("word-order variants reject opponent targets and invalid source locations without paying the source", () => {
  for (const abilityId of ["cfa-4731:0", "cfa-5052:0"]) {
    const { card, ability } = family.find(item => item.ability.id === abilityId);
    const f = fixture(card, "bot");
    const opponentTarget = { uid: `opponent-target-${card.id}`, cardId: "cfa-3", type: "Unit", unitCard: true, ownerPlayerId: "host-player", controllerPlayerId: "host-player", circle: "rear-left", turnPowerBoost: 0 };
    f.state.players.human.rear[0] = opponentTarget;
    const rejectedTarget = Reducer.applyManualAbilityActivation(f.state, {
      actorAuthUid: seats.guestAuthUid,
      actionId: `reject-opponent-target-${card.id}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ability.id, selection: { targetUid: opponentTarget.uid } }
    }, seats, Engine);
    assert.equal(rejectedTarget.ok, false, `${abilityId} rejects opponent targets`);
    assert.equal(f.state.players.bot.rear.includes(f.source), true, `${abilityId} does not pay after invalid target`);
    assert.equal(f.state.players.bot.soul.length, 0, `${abilityId} has no partial cost payment`);

    f.state.players.bot.rear = f.state.players.bot.rear.filter(unit => unit !== f.source);
    f.state.players.bot.hand.push(f.source);
    const wrongLocation = Reducer.applyManualAbilityActivation(f.state, {
      actorAuthUid: seats.guestAuthUid,
      actionId: `reject-wrong-location-${card.id}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ability.id, selection: { targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(wrongLocation.ok, false, `${abilityId} rejects a source outside RC`);
    assert.equal(f.state.players.bot.soul.length, 0, `${abilityId} still has no partial payment`);
    assert.equal(f.target.turnPowerBoost, 0, `${abilityId} does not apply power after rejection`);
  }
});
