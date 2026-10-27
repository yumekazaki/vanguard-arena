"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-2920", "cfa-3207", "cfa-4636"];
const PATTERN_ID = "auto-rc-placement-soul-blast-counter-charge-two-v1";
const PRINTED_TEXT = "AUTO: [Soul Blast 2] When this unit is placed on RC, you may pay the cost. If you do, Counter Charge 2.";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0], side = "human", { faceDownDamage = 2, soulCount = 2, circle = "rear-left" } = {}) {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `${cardId} exists in the catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 is compiled`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `placed-source-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1, power: 8000 };
  const soul = Array.from({ length: soulCount }, (_, i) => ({ uid: `soul-${side}-${i + 1}`, cardId: `soul-${side}-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId }));
  const damage = Array.from({ length: faceDownDamage }, (_, i) => ({ uid: `damage-${side}-${i + 1}`, cardId: `damage-${side}-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: true }));
  const rear = Array(5).fill(null);
  const rearIndex = circle === "rear-left" ? 0 : circle === "rear-right" ? 1 : 2;
  const players = {
    human: { playerId: "player-host", vanguard: null, rear: side === "human" && circle.startsWith("rear-") ? rear : Array(5).fill(null), hand: [], damage: side === "human" ? damage : [], soul: side === "human" ? soul : [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] },
    bot: { playerId: "player-guest", vanguard: null, rear: side === "bot" && circle.startsWith("rear-") ? rear : Array(5).fill(null), hand: [], damage: side === "bot" ? damage : [], soul: side === "bot" ? soul : [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] }
  };
  let sourceLocation = circle;
  if (circle.startsWith("rear-")) players[side].rear[rearIndex] = source;
  else if (circle === "vanguard") { players[side].vanguard = source; sourceLocation = "vanguard"; }
  else { players[side].hand.push(source); sourceLocation = "hand"; }
  const state = { matchId: "rc-soulblast-countercharge-test", stateVersion: 1, eventSequence: 0, turn: 3, side, phase: 4,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: sourceLocation, circle: sourceLocation, phase: "main", timingWindow: "call-resolution"
  });
  return { state, event, ability, source, side, playerId, opponentId, soul, damage };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respond(f, { accept = true, actor = f.side, actionId = `resolve-${f.side}`, soulUids = f.soul.slice(0, 2).map(card => card.uid), damageUids = f.damage.map(card => card.uid) } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: [], sb: soulUids }, damageUids } }
  }, seats, Engine);
}

test("all three exact records compile the optional RC-only Soul Blast 2 / Counter Charge 2 AUTO", () => {
  for (const cardId of IDS) {
    const f = fixture(cardId);
    assert.equal(f.ability.kind, "AUTO", cardId);
    assert.equal(f.ability.printedText, PRINTED_TEXT, cardId);
    assert.equal(f.ability.definition.source.patternId, PATTERN_ID, cardId);
    assert.equal(f.ability.trigger.eventType, "card.placed", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.deepEqual(f.ability.trigger.circles, ["rear-guard"], cardId);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"], cardId);
    assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count: 2 }], cardId);
    assert.equal(f.ability.canDecline, true, cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "counter-charge", count: 2 }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
  }
});

test("only the exact source's Rear-Guard placement prompts its controller on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
  }
  const wrongSource = fixture(IDS[0], "bot");
  wrongSource.event = Engine.createGameEvent(wrongSource.state, {
    type: "card.placed", actingPlayerId: wrongSource.playerId, turnPlayerId: wrongSource.playerId,
    sourceCardInstanceId: "another-card-copy", sourceOwnerPlayerId: wrongSource.playerId, sourceControllerPlayerId: wrongSource.playerId,
    cardInstanceId: "another-card-copy", subjectCardInstanceId: "another-card-copy", subjectOwnerPlayerId: wrongSource.playerId,
    subjectControllerPlayerId: wrongSource.playerId, previousLocation: "hand", currentLocation: "rear-right", circle: "rear-right", phase: "main", timingWindow: "call-resolution"
  });
  assert.equal(discover(wrongSource).queued.length, 0);

  const wrongCircle = fixture(IDS[0], "bot", { circle: "vanguard" });
  assert.equal(discover(wrongCircle).queued.length, 0);
});

test("accept pays exactly Soul Blast 2 and Counter Charges up to the available face-down Damage", () => {
  for (const [side, faceDownDamage] of [["human", 2], ["bot", 1]]) {
    const f = fixture(IDS[1], side, { faceDownDamage, soulCount: 2 });
    assert.equal(discover(f).queued.length, 1);
    const selectedDamage = f.damage.map(card => card.uid);
    const result = respond(f, { actionId: `resolve-cc-${side}`, damageUids: selectedDamage });
    assert.equal(result.ok, true, result.reason);
    const player = f.state.players[side];
    assert.equal(player.soul.length, 0);
    assert.equal(player.drop.length, 2);
    assert.deepEqual(player.damage.map(card => card.faceDown), Array(faceDownDamage).fill(false));
    assert.deepEqual(player.damage.map(card => card.uid), selectedDamage);
  }
});

test("declining leaves Soul and Damage unchanged, and the host cannot proxy the joiner's activation", () => {
  const declined = fixture(IDS[2], "human");
  assert.equal(discover(declined).queued.length, 1);
  const declineResult = respond(declined, { accept: false });
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.state.players.human.soul.length, 2);
  assert.deepEqual(declined.state.players.human.damage.map(card => card.faceDown), [true, true]);
  assert.equal(declined.state.players.human.drop.length, 0);

  const joined = fixture(IDS[0], "bot");
  assert.equal(discover(joined).queued.length, 1);
  const forged = respond(joined, { actor: "human", actionId: "host-proxies-joiner-countercharge" });
  assert.equal(forged.ok, false);
  assert.equal(joined.state.pendingAbility.instance.uid, joined.source.uid);
  assert.equal(joined.state.players.bot.soul.length, 2);
  assert.deepEqual(joined.state.players.bot.damage.map(card => card.faceDown), [true, true]);
});

test("invalid Soul Blast or damage selections reject atomically; duplicate event and action are rejected", () => {
  const f = fixture(IDS[0], "bot");
  assert.equal(discover(f).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  const invalidCost = respond(f, { soulUids: [f.soul[0].uid, "forged-soul"] });
  assert.equal(invalidCost.ok, false);
  assert.equal(f.state.players.bot.soul.length, 2);
  assert.deepEqual(f.state.players.bot.damage.map(card => card.faceDown), [true, true]);
  assert.equal(f.state.players.bot.drop.length, 0);

  const invalidDamage = respond(f, { actionId: "invalid-damage-choice", damageUids: ["forged-damage"] });
  assert.equal(invalidDamage.ok, false);
  assert.equal(f.state.players.bot.soul.length, 2);
  assert.deepEqual(f.state.players.bot.damage.map(card => card.faceDown), [true, true]);
  assert.equal(f.state.players.bot.drop.length, 0);
});
