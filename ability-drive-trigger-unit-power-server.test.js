"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = [["cfa-6292", 1], ["cfa-6890", 0], ["cfa-10857", 1]];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0][0], side = "human", { checkedTrigger = "critical", eventTrigger = checkedTrigger, checkedUid = "checked-trigger" } = {}) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-rc-drive-check-trigger-unit-power-turn-v1");
  assert.ok(ability, `${cardId} compiles the drive-trigger AUTO`);
  const playerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "drive-source", cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1, power: 8000 };
  const attacker = { uid: "drive-attacker", cardId: "attacker", cardName: "Drive Vanguard", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3, power: 13000 };
  const opponentVanguard = { uid: "opponent-vanguard", cardId: "opponent-vanguard", cardName: "Opponent Vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3, power: 13000 };
  const checked = { uid: checkedUid, cardId: "checked-trigger-card", cardName: "Critical Trigger", ownerPlayerId: playerId, controllerPlayerId: playerId, type: "Trigger Unit", unitCard: true, grade: 0, triggerType: checkedTrigger };
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? attacker : opponentVanguard, rear: side === "human" ? [source, null, null, null, null] : Array(5).fill(null), triggerZone: side === "human" ? [checked] : [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? attacker : opponentVanguard, rear: side === "bot" ? [source, null, null, null, null] : Array(5).fill(null), triggerZone: side === "bot" ? [checked] : [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] }
  };
  const battleId = "drive-trigger-battle";
  const state = { matchId: "drive-trigger-test", stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId, attackerSide: side, attackerUid: attacker.uid, attackerZone: "vanguard", attackerPlayerId: playerId, defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 13000, critical: 1, awaitingDrive: true, driveChecksPerformed: 0 },
    pendingCheckCard: { side, uid: checkedUid, destination: "hand", checkKind: "drive", battleId } };
  const event = Engine.createGameEvent(state, {
    type: "drive.checked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: attacker.uid, sourceControllerPlayerId: playerId,
    cardInstanceId: checkedUid, subjectCardInstanceId: checkedUid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    checkedCardInstanceId: checkedUid, checkedCardTriggerType: eventTrigger, revealedTrigger: eventTrigger || null,
    previousLocation: "deck", currentLocation: "trigger", checkKind: "drive", battleId,
    phase: "battle", timingWindow: "drive-check"
  });
  return { state, event, ability, source, checked, side, playerId };
}

test("the three catalog abilities compile to exact trigger-unit drive-check power effects", () => {
  for (const [cardId, index] of IDS) {
    const card = catalog.find(item => item.id === cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:${index}`);
    assert.equal(ability.definition?.source?.patternId, "auto-rc-drive-check-trigger-unit-power-turn-v1", cardId);
    assert.equal(ability.trigger.eventType, "drive.checked", cardId);
    assert.equal(ability.trigger.subject, "controller", cardId);
    assert.equal(ability.trigger.checkedCardHasTriggerUnit, true, cardId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], cardId);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("a real trigger drive check resolves the source ability for its controller on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-6292", side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `drive-trigger-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.source.turnPowerBoost, 5000);
    assert.equal(f.source.turnPowerExpiry, f.playerId);
  }
});

test("a normal-unit check, another player's check, or inconsistent trigger identity cannot activate it", () => {
  const normal = fixture("cfa-6292", "bot", { checkedTrigger: "", eventTrigger: "" });
  assert.equal(Reducer.discoverAutoTriggers(normal.state, [normal.event], Engine).queued.length, 0);

  const mismatch = fixture("cfa-6292", "bot", { checkedTrigger: "critical", eventTrigger: "draw" });
  assert.equal(Reducer.discoverAutoTriggers(mismatch.state, [mismatch.event], Engine).queued.length, 0);

  const opponent = fixture("cfa-6292", "bot");
  const forged = Engine.createGameEvent(opponent.state, { ...opponent.event, eventId: "opponent-drive-check", actingPlayerId: "player-host", turnPlayerId: "player-host", sourceControllerPlayerId: "player-host" });
  assert.equal(Reducer.discoverAutoTriggers(opponent.state, [forged], Engine).queued.length, 0);
});
