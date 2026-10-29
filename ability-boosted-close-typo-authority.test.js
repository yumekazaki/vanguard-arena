"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-13434", "cfa-13449", "cfa-13493", "cfa-13518", "cfa-13551"];
const catalog = loadCatalog();
const BATCH = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === "auto-boosted-battle-close-source-to-soul-power-v1")
  .map(ability => ({ cardId: card.id, abilityId: ability.id })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0], side = "human", { eventBooster = true } = {}) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-boosted-battle-close-source-to-soul-power-v1");
  assert.ok(ability, `${cardId} has the typo-variant compiler`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "booster", cardId, cardName: card.name, clan: card.clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 1, power: 8000 };
  const target = { uid: "target", cardId: "target", cardName: "Friendly Unit", clan: card.clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 2, power: 10000 };
  const vanguard = { uid: "vg", cardId: "vg", cardName: "Friendly Vanguard", clan: card.clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg", cardName: "Opponent Vanguard", clan: "Kagero", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? [target, null, source, null, null] : Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? [target, null, source, null, null] : Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "boosted-close-test", stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "battle.close-step", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: "attacker", subjectCardInstanceId: "attacker", subjectControllerPlayerId: ownerId,
    boosterCardInstanceId: eventBooster ? source.uid : "another-booster", boostedCardInstanceId: "attacker",
    currentLocation: "rear-back-left", battleId: "boost-battle", phase: "battle", timingWindow: "close-step"
  });
  return { state, event, ability, source, target, ownerId, side };
}

test("the five exact catalog typo records preserve printed text and the reviewed booster trigger", () => {
  for (const id of IDS) {
    const f = fixture(id);
    assert.match(f.ability.printedText, /end of the batle this unit boosted/i);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"], id);
    assert.deepEqual(f.ability.costs, [{ type: "source-to-soul", count: 1 }], id);
    assert.equal(f.ability.trigger.eventType, "battle.close-step", id);
    assert.equal(f.ability.trigger.subject, "booster", id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
});

test("all catalog abilities in the boosted battle-close batch have production definitions and exact legal data", () => {
  assert.equal(BATCH.length, 27);
  for (const entry of BATCH) {
    const card = catalog.find(item => item.id === entry.cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === entry.abilityId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(entry.cardId).some(item => item.id === entry.abilityId), entry.abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, entry.abilityId);
    assert.equal(ability.trigger.eventType, "battle.close-step", entry.abilityId);
    assert.equal(ability.trigger.subject, "booster", entry.abilityId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], entry.abilityId);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }], entry.abilityId);
    assert.equal(ability.effects[0].amount, Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), entry.abilityId);
  }
});

test("every batch card resolves for its own host or joining-player controller", () => {
  for (const { cardId } of BATCH) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${cardId}:${side}`);
    assert.equal(f.state.pendingAbility.side, side, `${cardId}:${side}`);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `boost-close-batch-${cardId}-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${cardId}:${side}: ${result.reason}`);
    assert.equal(f.state.players[side].soul.some(card => card.uid === f.source.uid), true, `${cardId}:${side}`);
    assert.equal(f.target.turnPowerBoost, Number(f.ability.effects[0].amount), `${cardId}:${side}`);
  }
});

test("the exact booster controller resolves their own source-to-Soul cost and friendly power choice", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const proxy = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.guestAuthUid : seats.hostAuthUid,
      actionId: `boost-close-proxy-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(proxy.ok, false);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `boost-close-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].soul.some(card => card.uid === f.source.uid), true);
    assert.equal(f.target.turnPowerBoost, 2000);
    assert.equal(f.state.players[side].rear.includes(f.source), false);
  }
});

test("another booster and a wrong target/controller cannot satisfy the trigger or resolution", () => {
  const wrongBooster = fixture(IDS[0], "bot", { eventBooster: false });
  assert.equal(Reducer.discoverAutoTriggers(wrongBooster.state, [wrongBooster.event], Engine).queued.length, 0);

  const valid = fixture(IDS[0], "bot");
  Reducer.discoverAutoTriggers(valid.state, [valid.event], Engine);
  const foreignTarget = valid.state.players.human.vanguard;
  const result = Reducer.applyAbilityDecision(valid.state, {
    actorAuthUid: seats.guestAuthUid, actionId: "boost-close-foreign-target", expectedStateVersion: valid.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: valid.source.uid, abilityId: valid.ability.id, targetUid: foreignTarget.uid } }
  }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(valid.state.players.bot.rear.includes(valid.source), true);
  assert.equal(valid.target.turnPowerBoost || 0, 0);
});
