"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-1352", "cfa-1416", "cfa-1425"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0], side = "human", { attackerUid = null, targetZone = "vanguard", turnPlayerOverride = null } = {}) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-vanguard-own-attack-soul-charge-power-battle-v1");
  assert.ok(ability, `${cardId} compiles the Vanguard attack AUTO`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `attack-source-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3, power: 10000 };
  const opponentVanguard = { uid: `opponent-vanguard-${side}`, cardId: "opponent-vanguard", cardName: "Opponent Vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3, power: 13000 };
  const top = { uid: `attack-soul-top-${side}`, cardId: "soul-charge-top", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? source : opponentVanguard, rear: [], deck: side === "human" ? [top] : [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? source : opponentVanguard, rear: [], deck: side === "bot" ? [top] : [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] }
  };
  const attack = { battleId: `battle-${side}`, attackerUid: attackerUid || source.uid, attackerSide: side, attackerZone: "vanguard", defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: targetZone, power: 10000, targetPower: 13000, critical: 1, guardCards: [] };
  const state = { matchId: "vanguard-attack-soul-charge-test", stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingAttack: attack, players };
  const turnPlayerId = turnPlayerOverride || playerId;
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: playerId, turnPlayerId,
    sourceCardInstanceId: attackerUid || source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: attackerUid || source.uid, subjectCardInstanceId: attackerUid || source.uid,
    attackingCardInstanceIds: [attackerUid || source.uid], subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "vanguard", currentLocation: "vanguard", targetCardInstanceIds: [opponentVanguard.uid], targetLocation: targetZone,
    battleId: attack.battleId, phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, opponentVanguard, top, side, playerId };
}

test("the three real catalog abilities compile to ordered Soul Charge then battle power effects", () => {
  for (const cardId of IDS) {
    const ability = Engine.parseCardAbilitiesCached(catalog.find(item => item.id === cardId)).find(item => item.id === `${cardId}:1`);
    assert.equal(ability.definition?.source?.patternId, "auto-vanguard-own-attack-soul-charge-power-battle-v1", cardId);
    assert.equal(ability.trigger.eventType, "unit.attacked", cardId);
    assert.equal(ability.trigger.subject, "source", cardId);
    assert.equal(ability.trigger.targetLocation, "vanguard", cardId);
    assert.deepEqual(ability.requiredLocation, ["vanguard"], cardId);
    assert.deepEqual(ability.definition.effects, [
      { op: "soul-charge", count: 1 },
      { op: "modify-power", target: "source", amount: 1000, duration: "battle" }
    ], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the exact attacking Vanguard's controller Soul Charges then gets +1000 for that battle on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `vanguard-attack-soul-charge-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].soul[0]?.uid, f.top.uid);
    assert.equal(f.state.pendingAttack.power, 11000);
    assert.equal(f.source.power, 10000);
  }
});

test("another attacker, a Rear-Guard target, the opponent's turn, and host proxying are rejected", () => {
  const otherAttacker = fixture(IDS[0], "human", { attackerUid: "different-vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(otherAttacker.state, [otherAttacker.event], Engine).queued.length, 0);

  const rearGuardTarget = fixture(IDS[0], "human", { targetZone: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardTarget.state, [rearGuardTarget.event], Engine).queued.length, 0);

  const opponentTurn = fixture(IDS[0], "human", { turnPlayerOverride: "player-guest" });
  assert.equal(Reducer.discoverAutoTriggers(opponentTurn.state, [opponentTurn.event], Engine).queued.length, 0);

  const guest = fixture(IDS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(guest.state, [guest.event], Engine).queued.length, 1);
  const forged = Reducer.applyAbilityDecision(guest.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "host-forges-guest-attack-trigger", expectedStateVersion: guest.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: guest.source.uid, abilityId: guest.ability.id } }
  }, seats, Engine);
  assert.equal(forged.ok, false);
  assert.equal(guest.state.players.bot.soul.length, 0);
  assert.equal(guest.state.pendingAttack.power, 10000);
});
