"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = ["cfa-6766", "cfa-6774", "cfa-6776", "cfa-6791", "cfa-6792"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === id);
function instance(cardId, uid, playerId, extra = {}) {
  const card = byId(cardId) || {};
  return { uid, cardId, cardName: card.name || cardId, type: card.type || "Unit", grade: Number(card.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId, side = "bot", circle = "rear-left") {
  const card = byId(cardId);
  const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `ability exists for ${cardId}`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const pid = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherPid = side === "human" ? "player-guest" : "player-host";
  const source = instance(cardId, `source-${side}`, pid, { zone: circle === "vanguard" ? "vanguard" : circle === "rear-left" ? "rear-guard" : circle, circle, rested: true });
  const checked = instance("heal-check", `checked-${side}`, pid, { triggerType: "heal", zone: "trigger" });
  const vanguard = circle === "vanguard" ? source : instance("cfa-7046", `vg-${side}`, pid, { zone: "vanguard", circle: "vanguard" });
  const otherVanguard = instance("cfa-3", `opp-vg-${side}`, otherPid, { zone: "vanguard", circle: "vanguard" });
  const own = { playerId: pid, vanguard, rear: circle === "vanguard" || circle !== "rear-left" ? Array(5).fill(null) : [source, null, null, null, null], hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: circle === "guardian" ? [source] : [], orders: [], gDeck: [], gZone: [], triggerZone: [checked] };
  const opponent = { playerId: otherPid, vanguard: otherVanguard, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const battleId = `heal-drive-${cardId}-${side}`;
  const state = { matchId: "heal-drive", stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingCheckCard: { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId }, phase: 5, turn: 4, side, players, pendingAttack: { battleId, attackerSide: side, attackerPlayerId: pid, attackerUid: vanguard.uid, attackerZone: "vanguard", defenderSide: otherSide, targetUid: otherVanguard.uid, targetZone: "vanguard", driveChecksRemaining: 0, driveChecksComplete: true, maxDriveChecks: 1, driveChecksPerformed: 1, awaitingDrive: false, power: 13000, targetPower: 10000, guardCards: [] } };
  const event = Engine.createGameEvent(state, { type: "drive.checked", actingPlayerId: pid, turnPlayerId: pid, sourceCardInstanceId: vanguard.uid, sourceControllerPlayerId: pid, subjectCardInstanceId: checked.uid, subjectControllerPlayerId: pid, checkedCardInstanceId: checked.uid, checkedCardTriggerType: "heal", revealedTrigger: "heal", checkKind: "drive", checkIndex: 1, previousLocation: "deck", currentLocation: "trigger", battleId, phase: "battle", timingWindow: "drive-check" });
  return { ability, source, checked, own, state, event, side, pid };
}
function resolve(f, accept = true) {
  const auth = f.side === "human" ? "auth-host" : "auth-guest";
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-${f.event.eventId}`, expectedStateVersion: f.state.stateVersion, payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("heal-trigger drive AUTO is available to its own controller on either online seat and stands its exact source", () => {
  for (const cardId of cards) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    assert.equal(f.ability.trigger.status, "recognized-trigger", `${cardId} parser`);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, `${cardId} effect support`);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${cardId}/${side} eligible`);
    assert.equal(f.state.pendingAbility.side, side, `${cardId}/${side} private owner prompt`);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.source.rested, false);
    assert.ok((f.state.players[side].usedAbilities || []).length > 0, "once-per-turn usage recorded");
  }
});

test("heal-trigger drive AUTO rejects non-heal checks, the opponent's drive check, wrong circles, and duplicate use", () => {
  const wrongTrigger = fixture("cfa-6766");
  const nonHeal = Engine.createGameEvent(wrongTrigger.state, { ...wrongTrigger.event, eventId: "non-heal-drive", checkedCardTriggerType: "draw", revealedTrigger: "draw" });
  assert.equal(Reducer.discoverAutoTriggers(wrongTrigger.state, [nonHeal], Engine).queued.length, 0);

  const wrongPlayer = fixture("cfa-6766");
  const opponentEvent = Engine.createGameEvent(wrongPlayer.state, { ...wrongPlayer.event, eventId: "opponent-heal-drive", actingPlayerId: "player-host", turnPlayerId: "player-host" });
  assert.equal(Reducer.discoverAutoTriggers(wrongPlayer.state, [opponentEvent], Engine).queued.length, 0);

  const wrongCircle = fixture("cfa-6766", "bot", "guardian");
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

  const once = fixture("cfa-6792");
  assert.equal(Reducer.discoverAutoTriggers(once.state, [once.event], Engine).queued.length, 1);
  assert.equal(resolve(once).ok, true);
  const secondEvent = Engine.createGameEvent(once.state, { ...once.event, eventId: "second-heal-drive" });
  assert.equal(Reducer.discoverAutoTriggers(once.state, [secondEvent], Engine).queued.length, 0);
});

test("declining the optional heal-trigger AUTO consumes that event and does not reopen its prompt", () => {
  const f = fixture("cfa-6774");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = resolve(f, false);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.source.rested, true);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
});
