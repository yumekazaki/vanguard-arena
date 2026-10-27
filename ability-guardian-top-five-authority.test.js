"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");

const PATTERN = "auto-gc-counter-blast-call-top-to-guardian-v1";
const CARD_IDS = ["cfa-1987", "cfa-1996", "cfa-2077", "cfa-2088", "cfa-2097", "cfa-2156", "cfa-2178", "cfa-2241", "cfa-2302", "cfa-2364", "cfa-2389", "cfa-2403", "cfa-2744", "cfa-3091", "cfa-3138", "cfa-3391"];
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const makeCard = (uid, cardId, playerId, extra = {}) => ({ uid, cardId, ownerPlayerId: playerId, controllerPlayerId: playerId, type: "Unit", unitCard: true, grade: 1, shield: 5000, ...extra });

function guardianState(defenderSide = "bot", cardId = "cfa-1987") {
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const defenderId = defenderSide === "human" ? "host-player" : "guest-player";
  const attackerId = attackerSide === "human" ? "host-player" : "guest-player";
  const source = makeCard("guardian-source", cardId, defenderId);
  const topCards = [5000, 10000, 15000, 0, 5000].map((shield, index) => makeCard(`deck-unit-${index + 1}`, `unit-${index + 1}`, defenderId, { shield }));
  const state = {
    matchId: "guardian-top-five-match", stateVersion: 9, processedActionIds: [], turn: 4, phase: 5, side: attackerSide,
    players: {
      human: { playerId: "host-player", vanguard: makeCard("host-vg", "host-vg", "host-player", { grade: 3, power: 13000 }), rear: [null, null, null, null, null], hand: [], deck: defenderSide === "human" ? [...topCards] : [], damage: defenderSide === "human" ? [{ uid: "host-cb", cardId: "damage", ownerPlayerId: defenderId, controllerPlayerId: defenderId, faceDown: true }] : [], drop: [], soul: [], bind: [], guardCircle: defenderSide === "human" ? [source] : [], triggerZone: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [] },
      bot: { playerId: "guest-player", vanguard: makeCard("guest-vg", "guest-vg", "guest-player", { grade: 3, power: 13000 }), rear: [null, null, null, null, null], hand: [], deck: defenderSide === "bot" ? [...topCards] : [], damage: defenderSide === "bot" ? [{ uid: "guest-cb", cardId: "damage", ownerPlayerId: defenderId, controllerPlayerId: defenderId, faceDown: true }] : [], drop: [], soul: [], bind: [], guardCircle: defenderSide === "bot" ? [source] : [], triggerZone: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [] }
    },
    pendingAttack: {
      battleId: "guardian-battle", attackerSide, attackerPlayerId: attackerId, attackerUid: `${attackerSide}-vg`, attackerZone: "vanguard",
      defenderSide, defenderPlayerId: defenderId, targetUid: `${defenderSide}-vg`, targetZone: "vanguard", power: 23000, targetPower: 13000,
      critical: 1, guardCards: [source], defenderDone: false, driveChecksRemaining: 0, driveCountPrompt: false
    }
  };
  state.players[defenderSide].damage[0].faceDown = false;
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: defenderId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: defenderId, sourceControllerPlayerId: defenderId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: defenderId,
    subjectControllerPlayerId: defenderId, previousLocation: "hand", currentLocation: "guardian", circle: "guardian",
    battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "guard-placement"
  });
  return { state, source, event, defenderSide, defenderId, attackerSide, topCards };
}

function discoverCharge(setup, event = setup.event) {
  return Reducer.discoverAutoTriggers(setup.state, [event], Engine);
}

function resolve(setup, selection = {}, authOverride = null) {
  const side = setup.defenderSide, pending = setup.state.pendingAbility;
  return Reducer.applyAbilityDecision(setup.state, {
    actorAuthUid: authOverride || (side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid),
    actionId: `guardian-resolve-${side}`, expectedStateVersion: setup.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: setup.source.uid, abilityId: pending.ability.id, ...selection } }
  }, SEATS, Engine);
}

test("all 16 Guardian top-five AUTO definitions retain the exact two printed variants", () => {
  const { loadCatalog } = require("./scripts/audit-ability-catalog.js"), parsed = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilities(card)) if (ability.definition?.source?.patternId === PATTERN) parsed.push(ability);
  assert.equal(parsed.length, 16);
  assert.deepEqual(parsed.map(ability => ability.cardId).sort(), [...CARD_IDS].sort());
  assert.ok(parsed.every(ability => ability.definition.effects.length === 1 && ability.definition.effects[0].op === "call-top-to-guardian" && Reducer.supportsServerAbilityEffects(ability)));
  assert.equal(new Set(parsed.map(ability => ability.definition.printedText)).size, 2);
  assert.ok(parsed.every(ability => ability.canDecline && ability.costs.length === 1 && ability.costs[0].type === "counter-blast" && ability.costs[0].count === 1));
});

test("host and joining defender each pay CB1 and call the top five units at rest with exact shield", () => {
  for (const side of ["human", "bot"]) {
    const setup = guardianState(side);
    const queued = discoverCharge(setup);
    assert.equal(queued.queued.length, 1, `${side}: ${JSON.stringify(queued.skipped)}`);
    assert.equal(setup.state.pendingAbility.side, side);
    assert.equal(setup.state.pendingAbility.instance.uid, setup.source.uid);
    const resolved = resolve(setup, { costSelections: { cb: [`${side === "human" ? "host" : "guest"}-cb`] } });
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason}`);
    const player = setup.state.players[side];
    assert.equal(player.damage[0].faceDown, true);
    assert.deepEqual(player.deck, []);
    assert.equal(player.guardCircle.length, 6);
    assert.deepEqual(player.guardCircle.slice(1).map(card => card.uid), setup.topCards.map(card => card.uid).reverse());
    assert.ok(player.guardCircle.slice(1).every(card => card.position === "rest" && card.rested === true && card.circle === "guardian"));
    assert.equal(setup.state.pendingAttack.guardCards.length, 6);
    assert.equal(setup.state.pendingAttack.targetPower, 48000);
    const placements = resolved.events.filter(event => event.type === "card.placed" && event.previousLocation === "deck");
    assert.equal(placements.length, 5);
    assert.ok(placements.every(event => event.currentLocation === "guardian" && event.timingWindow === "effect-placement" && event.battleId === setup.state.pendingAttack.battleId));
    assert.equal(setup.state.pendingAbility, null);
  }
});

test("Guardian top-five AUTO is exact to its controller, source, circle, and active battle", () => {
  const correct = guardianState("bot");
  assert.equal(discoverCharge(correct).queued.length, 1);
  const wrongSeat = resolve(correct, { costSelections: { cb: ["guest-cb"] } }, SEATS.hostAuthUid);
  assert.equal(wrongSeat.ok, false);
  assert.equal(wrongSeat.reason, "source-not-controlled");

  for (const change of [
    { battleId: "old-battle" }, { timingWindow: "effect-placement" }, { previousLocation: "rear-left" },
    { currentLocation: "rear-left", circle: "rear-left" }, { sourceCardInstanceId: "other-copy", cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" }
  ]) {
    const setup = guardianState("bot"), event = Engine.createGameEvent(setup.state, { ...setup.event, ...change, eventId: undefined });
    assert.equal(discoverCharge(setup, event).queued.length, 0, JSON.stringify(change));
    assert.equal(Boolean(setup.state.pendingAbility), false);
  }
});

test("Guardian top-five declines safely and invalid costs or non-Unit deck cards do not partially resolve", () => {
  const decline = guardianState("bot"); discoverCharge(decline);
  const declined = Reducer.applyAbilityDecision(decline.state, {
    actorAuthUid: SEATS.guestAuthUid, actionId: "guardian-decline", expectedStateVersion: decline.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: decline.source.uid, abilityId: decline.state.pendingAbility.ability.id } }
  }, SEATS, Engine);
  assert.equal(declined.ok, true);
  assert.equal(decline.state.players.bot.damage[0].faceDown, false);
  assert.equal(decline.state.players.bot.deck.length, 5);

  const badCost = guardianState("bot"); discoverCharge(badCost);
  const invalidPayment = resolve(badCost, { costSelections: { cb: ["not-in-damage"] } });
  assert.equal(invalidPayment.ok, false);
  assert.equal(badCost.state.players.bot.damage[0].faceDown, false);
  assert.equal(badCost.state.players.bot.deck.length, 5);
  assert.equal(badCost.state.pendingAbility.instance.uid, badCost.source.uid);

  const badDeck = guardianState("bot"); badDeck.topCards[2].type = "Order"; discoverCharge(badDeck);
  const noCall = resolve(badDeck, { costSelections: { cb: ["guest-cb"] } });
  assert.equal(noCall.ok, false);
  assert.equal(badDeck.state.players.bot.damage[0].faceDown, false);
  assert.equal(badDeck.state.players.bot.deck.length, 5);
  assert.equal(badDeck.state.players.bot.guardCircle.length, 1);
});
