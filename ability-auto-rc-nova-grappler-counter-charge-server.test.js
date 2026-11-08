"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-125", "cfa-146"];
const TEXT = "AUTO: When this unit is placed on RC, if you have a «Nova Grappler» vanguard, choose a card from your damage zone and turn it face up. (Counter Charge 1)";
const OFFICIAL = "[AUTO]:When this unit is placed on (RC), if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();

function findUnit(clan, grade = 3) {
  const card = catalog.find(item => item.type === "Unit" && item.clan === clan && Number(item.grade) === grade);
  assert.ok(card, `catalog has a grade ${grade} ${clan} Vanguard`);
  return card;
}

function fixture(cardId, side = "human", { vanguardClan = "Nova Grappler", circle = "rear-left", faceDownDamage = 2 } = {}) {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `${cardId} exists in catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 has a compiled definition`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const vanguardDefinition = findUnit(vanguardClan);
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: card.grade, power: card.power };
  const vanguard = { uid: `vg-${side}`, cardId: vanguardDefinition.id, cardName: vanguardDefinition.name, clan: vanguardDefinition.clan, clans: vanguardDefinition.clans, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3, power: vanguardDefinition.power };
  const damage = Array.from({ length: faceDownDamage }, (_, index) => ({ uid: `damage-${side}-${index + 1}`, cardId: `damage-${side}-${index + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: true }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : null, rear: Array(8).fill(null), hand: [], damage: side === "human" ? damage : [], soul: [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : null, rear: Array(8).fill(null), hand: [], damage: side === "bot" ? damage : [], soul: [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] }
  };
  const index = circle === "rear-left" ? 0 : circle === "rear-right" ? 1 : circle === "accel-1" ? 5 : -1;
  if (index >= 0) players[side].rear[index] = source;
  else if (circle === "vanguard") { players[side].vanguard = source; source.zone = "vanguard"; }
  else players[side].hand.push(source);
  const state = { matchId: "nova-counter-charge-test", stateVersion: 1, eventSequence: 0, turn: 2, side, phase: 4,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: circle, circle, phase: "main", timingWindow: "call-resolution"
  });
  return { state, event, ability, source, side, playerId, damage, vanguard, cardId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respond(f, { accept = true, actor = f.side, actionId = `resolve-${f.side}-${f.cardId}`, damageUids = f.damage.slice(0, 1).map(card => card.uid) } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, damageUids } }
  }, SEATS, Engine);
}

test("both official EB08 records compile the exact mandatory Nova Grappler placement Counter Charge", () => {
  for (const [cardId, number] of [["cfa-125", "EB08/023EN"], ["cfa-146", "EB08/020EN"]]) {
    const f = fixture(cardId);
    const definition = f.ability.definition;
    assert.equal(definition.printedText, TEXT);
    assert.equal(definition.source.patternId, "auto-rc-placement-nova-grappler-counter-charge-one-v1");
    assert.equal(definition.source.officialCardNumber, number);
    assert.equal(definition.source.officialTextVerified, true);
    assert.equal(definition.source.officialPrintedText, OFFICIAL);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.trigger.circles, ["rear-guard"]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: "Nova Grappler" }]);
    assert.deepEqual(f.ability.costs, []);
    assert.equal(f.ability.canDecline, false);
    assert.deepEqual(definition.effects, [{ op: "counter-charge", target: "controller", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
  }
});

test("the exact placed card triggers only on its own Rear-Guard Circle with the controller's Nova Grappler Vanguard", () => {
  const legal = fixture("cfa-125", "bot");
  assert.equal(discover(legal).queued.length, 1);
  assert.equal(legal.state.pendingAbility.instance.uid, legal.source.uid);
  assert.equal(legal.state.pendingAbility.side, "bot");
  assert.equal(legal.state.pendingAbility.triggerControllerPlayerId, legal.playerId);
  assert.equal(discover(legal).queued.length, 0, "the same event cannot create a duplicate trigger");

  const wrongVanguard = fixture("cfa-146", "bot", { vanguardClan: "Aqua Force" });
  assert.equal(discover(wrongVanguard).queued.length, 0);
  const wrongCircle = fixture("cfa-125", "bot", { circle: "vanguard" });
  assert.equal(discover(wrongCircle).queued.length, 0);
  const unrelatedEvent = fixture("cfa-146", "human");
  unrelatedEvent.event = Engine.createGameEvent(unrelatedEvent.state, {
    type: "card.placed", actingPlayerId: unrelatedEvent.playerId, turnPlayerId: unrelatedEvent.playerId,
    sourceCardInstanceId: "different-card", sourceOwnerPlayerId: unrelatedEvent.playerId, sourceControllerPlayerId: unrelatedEvent.playerId,
    cardInstanceId: "different-card", subjectCardInstanceId: "different-card", subjectOwnerPlayerId: unrelatedEvent.playerId, subjectControllerPlayerId: unrelatedEvent.playerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "call-resolution"
  });
  assert.equal(discover(unrelatedEvent).queued.length, 0);
});

test("the host and joining player resolve only their own chosen Damage card", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-125", side);
    assert.equal(discover(f).queued.length, 1);
    const result = respond(f);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].damage.map(card => card.faceDown), [false, true]);
    const opponent = side === "human" ? "bot" : "human";
    assert.deepEqual(f.state.players[opponent].damage, []);
  }
  const forged = fixture("cfa-146", "bot");
  assert.equal(discover(forged).queued.length, 1);
  assert.equal(respond(forged, { actor: "human", actionId: "host-cannot-resolve-joiner-counter-charge" }).ok, false);
  assert.deepEqual(forged.state.players.bot.damage.map(card => card.faceDown), [true, true]);
});

test("mandatory resolution turns one legal face-down Damage card face up and rejects decline or invalid targets atomically", () => {
  const decline = fixture("cfa-125", "human");
  assert.equal(discover(decline).queued.length, 1);
  assert.equal(respond(decline, { accept: false, actionId: "cannot-decline-mandatory-counter-charge" }).ok, false);
  assert.deepEqual(decline.state.players.human.damage.map(card => card.faceDown), [true, true]);

  const duplicate = fixture("cfa-146", "bot");
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(respond(duplicate, { damageUids: [duplicate.damage[0].uid, duplicate.damage[0].uid], actionId: "duplicate-damage-choice" }).ok, false);
  assert.deepEqual(duplicate.state.players.bot.damage.map(card => card.faceDown), [true, true]);

  const foreign = fixture("cfa-125", "human");
  foreign.state.players.bot.damage.push({ uid: "foreign-damage", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest", faceDown: true });
  assert.equal(discover(foreign).queued.length, 1);
  assert.equal(respond(foreign, { damageUids: ["foreign-damage"], actionId: "foreign-damage-choice" }).ok, false);
  assert.deepEqual(foreign.state.players.human.damage.map(card => card.faceDown), [true, true]);

  const noFaceDownDamage = fixture("cfa-146", "bot", { faceDownDamage: 0 });
  assert.equal(discover(noFaceDownDamage).queued.length, 1);
  assert.equal(respond(noFaceDownDamage, { damageUids: [], actionId: "resolve-with-no-face-down-damage" }).ok, true);
});

test("the Nova Grappler Vanguard condition is revalidated before the effect is committed", () => {
  const f = fixture("cfa-125", "bot");
  assert.equal(discover(f).queued.length, 1);
  const wrong = findUnit("Aqua Force");
  f.state.players.bot.vanguard = { ...f.vanguard, cardId: wrong.id, cardName: wrong.name, clan: wrong.clan, clans: wrong.clans };
  assert.equal(respond(f, { actionId: "vanguard-clan-changed-before-resolution" }).ok, false);
  assert.deepEqual(f.state.players.bot.damage.map(card => card.faceDown), [true, true]);
});
