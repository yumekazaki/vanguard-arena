"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SPECS = {
  "cfa-1576": { clan: "Oracle Think Tank" },
  "cfa-1884": { clan: "Kagero" },
  "cfa-1914": { clan: "Aqua Force" },
  "cfa-1966": { clan: "Bermuda Triangle" }
};
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const REAR = Array(5).fill(null);

function findUnit(clan, grade = 3) {
  const card = catalog.find(item => item.type === "Unit" && item.clan === clan && Number(item.grade) === grade);
  assert.ok(card, `catalog has a grade ${grade} ${clan} Vanguard`);
  return card;
}

function fixture(cardId = "cfa-1576", side = "human", { vanguardClan = SPECS[cardId].clan, circle = "rear-left", faceDownDamage = 2, soulCount = 2 } = {}) {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `${cardId} exists in the catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 has a compiled definition`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const vanguardCard = findUnit(vanguardClan);
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1, power: 5000 };
  const vanguard = { uid: `vg-${side}`, cardId: vanguardCard.id, cardName: vanguardCard.name, clan: vanguardCard.clan, clans: vanguardCard.clans, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3, power: vanguardCard.power };
  const soul = Array.from({ length: soulCount }, (_, i) => ({ uid: `soul-${side}-${i + 1}`, cardId: `soul-${side}-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId }));
  const damage = Array.from({ length: faceDownDamage }, (_, i) => ({ uid: `damage-${side}-${i + 1}`, cardId: `damage-${side}-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: true }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : null, rear: Array(5).fill(null), hand: [], damage: side === "human" ? damage : [], soul: side === "human" ? soul : [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : null, rear: Array(5).fill(null), hand: [], damage: side === "bot" ? damage : [], soul: side === "bot" ? soul : [], deck: [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] }
  };
  let sourceLocation = circle;
  if (circle.startsWith("rear-")) players[side].rear[0] = source;
  else if (circle === "vanguard") { players[side].vanguard = source; sourceLocation = "vanguard"; }
  else { players[side].hand.push(source); sourceLocation = "hand"; }
  const state = { matchId: "rc-clan-counter-charge-test", stateVersion: 1, eventSequence: 0, turn: 2, side, phase: 4,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: sourceLocation, circle: sourceLocation, phase: "main", timingWindow: "call-resolution"
  });
  return { state, event, ability, source, side, playerId, opponentId, soul, damage, vanguard, cardId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respond(f, { accept = true, actor = f.side, actionId = `resolve-${f.side}`, soul = f.soul.map(card => card.uid), damage = f.damage.slice(0, 2).map(card => card.uid) } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: [], sb: soul }, damageUids: damage } }
  }, seats, Engine);
}

test("the four matching clan-gated RC Soul Blast 2 / Counter Charge 2 abilities compile independently", () => {
  for (const [cardId, { clan }] of Object.entries(SPECS)) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition.source.patternId, "auto-rc-placement-clan-soul-blast-counter-charge-two-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.trigger.circles, ["rear-guard"]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }]);
    assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count: 2 }]);
    assert.equal(f.ability.canDecline, true);
    assert.deepEqual(f.ability.definition.effects, [{ op: "counter-charge-up-to", target: "controller", count: 2 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    if (cardId === "cfa-1966") assert.match(f.ability.definition.source.officialPrintedText, /turn those cards face up/i);
    if (cardId === "cfa-1884") assert.match(f.ability.definition.source.officialPrintedText, /<Kagero> vanguard/i);
  }
});

test("only the exact source placed on RC with the matching Vanguard clan becomes pending for its controller", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-1576", side);
    const discovered = discover(f);
    assert.equal(discovered.queued.length, 1, JSON.stringify(discovered));
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
  }
  const wrongClan = fixture("cfa-1576", "bot", { vanguardClan: "Aqua Force" });
  assert.equal(discover(wrongClan).queued.length, 0);
  const wrongCircle = fixture("cfa-1576", "bot", { circle: "vanguard" });
  assert.equal(discover(wrongCircle).queued.length, 0);
  const wrongSource = fixture("cfa-1576", "bot");
  wrongSource.event = Engine.createGameEvent(wrongSource.state, {
    type: "card.placed", actingPlayerId: wrongSource.playerId, turnPlayerId: wrongSource.playerId,
    sourceCardInstanceId: "unrelated-copy", sourceOwnerPlayerId: wrongSource.playerId, sourceControllerPlayerId: wrongSource.playerId,
    cardInstanceId: "unrelated-copy", subjectCardInstanceId: "unrelated-copy", subjectOwnerPlayerId: wrongSource.playerId,
    subjectControllerPlayerId: wrongSource.playerId, previousLocation: "hand", currentLocation: "rear-right", circle: "rear-right", phase: "main", timingWindow: "call-resolution"
  });
  assert.equal(discover(wrongSource).queued.length, 0);
});

test("both controllers may decline or pay Soul Blast 2 and choose up to two of their own Damage", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-1914", side);
    assert.equal(discover(f).queued.length, 1);
    const accepted = respond(f, { actionId: `accept-${side}` });
    assert.equal(accepted.ok, true, accepted.reason);
    assert.equal(f.state.players[side].soul.length, 0);
    assert.equal(f.state.players[side].drop.length, 2);
    assert.deepEqual(f.state.players[side].damage.map(card => card.faceDown), [false, false]);
  }
  const decline = fixture("cfa-1966", "bot");
  assert.equal(discover(decline).queued.length, 1);
  assert.equal(respond(decline, { accept: false }).ok, true);
  assert.equal(decline.state.players.bot.soul.length, 2);
  assert.deepEqual(decline.state.players.bot.damage.map(card => card.faceDown), [true, true]);
  const forged = fixture("cfa-1576", "bot");
  assert.equal(discover(forged).queued.length, 1);
  assert.equal(respond(forged, { actor: "human", actionId: "host-cannot-proxy-clan-counter-charge" }).ok, false);
});

test("the ‘up to two’ choice accepts zero, one, or two cards even when more face-down Damage is available", () => {
  for (const side of ["human", "bot"]) {
    for (const chosenCount of [0, 1, 2]) {
      const f = fixture("cfa-1884", side, { faceDownDamage: 4 });
      assert.equal(discover(f).queued.length, 1);
      const chosen = f.damage.slice(0, chosenCount).map(card => card.uid);
      const result = respond(f, { actionId: `choose-${chosenCount}-${side}`, damage: chosen });
      assert.equal(result.ok, true, result.reason);
      assert.equal(f.state.players[side].soul.length, 0);
      assert.equal(f.state.players[side].drop.length, 2);
      assert.equal(f.state.players[side].damage.filter(card => !card.faceDown).length, chosenCount);
    }
  }
  const noAvailable = fixture("cfa-1966", "bot", { faceDownDamage: 0 });
  assert.equal(discover(noAvailable).queued.length, 1);
  assert.equal(respond(noAvailable, { actionId: "choose-zero-no-face-down-damage", damage: [] }).ok, true);
  assert.equal(noAvailable.state.players.bot.soul.length, 0);
});

test("the server rejects over-limit, duplicate, face-up, and opponent-owned Damage selections atomically", () => {
  const overLimit = fixture("cfa-1576", "bot", { faceDownDamage: 4 });
  assert.equal(discover(overLimit).queued.length, 1);
  assert.equal(respond(overLimit, { actionId: "over-limit-damage", damage: overLimit.damage.slice(0, 3).map(card => card.uid) }).ok, false);
  assert.equal(overLimit.state.players.bot.soul.length, 2);
  assert.deepEqual(overLimit.state.players.bot.damage.map(card => card.faceDown), [true, true, true, true]);

  const duplicate = fixture("cfa-1914", "human", { faceDownDamage: 2 });
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(respond(duplicate, { actionId: "duplicate-damage", damage: [duplicate.damage[0].uid, duplicate.damage[0].uid] }).ok, false);
  assert.equal(duplicate.state.players.human.soul.length, 2);
  assert.deepEqual(duplicate.state.players.human.damage.map(card => card.faceDown), [true, true]);

  const faceUp = fixture("cfa-1966", "bot", { faceDownDamage: 2 });
  faceUp.damage[0].faceDown = false;
  assert.equal(discover(faceUp).queued.length, 1);
  assert.equal(respond(faceUp, { actionId: "face-up-damage", damage: [faceUp.damage[0].uid] }).ok, false);
  assert.equal(faceUp.state.players.bot.soul.length, 2);
  assert.deepEqual(faceUp.state.players.bot.damage.map(card => card.faceDown), [false, true]);

  const foreign = fixture("cfa-1884", "human", { faceDownDamage: 2 });
  foreign.state.players.bot.damage.push({ uid: "foreign-damage", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest", faceDown: true });
  assert.equal(discover(foreign).queued.length, 1);
  assert.equal(respond(foreign, { actionId: "foreign-damage", damage: ["foreign-damage"] }).ok, false);
  assert.equal(foreign.state.players.human.soul.length, 2);
  assert.deepEqual(foreign.state.players.human.damage.map(card => card.faceDown), [true, true]);
});

test("the ability prompt renders up-to selection and leaves zero choices legal", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert.match(app, /counter-charge-up-to.*includes\(step\.op\)/);
  assert.match(app, /chooseUpTo\?x\.damageUids\.length>required/);
  assert.match(app, /choose up to \"\+required\+\" face-down damage card/);
  assert.match(app, /counter-charge-up-to.*includes\(item\.op\)/);
});

test("conditions and exact resource selections are revalidated before any cost or effect is committed", () => {
  const changed = fixture("cfa-1576", "bot");
  assert.equal(discover(changed).queued.length, 1);
  const wrongVanguard = findUnit("Aqua Force");
  changed.state.players.bot.vanguard = { ...changed.vanguard, cardId: wrongVanguard.id, clan: wrongVanguard.clan, clans: wrongVanguard.clans };
  const conditionFailure = respond(changed, { actionId: "clan-changed-before-resolution" });
  assert.equal(conditionFailure.ok, false);
  assert.equal(changed.state.players.bot.soul.length, 2);
  assert.deepEqual(changed.state.players.bot.damage.map(card => card.faceDown), [true, true]);
  const badCost = fixture("cfa-1914", "human");
  assert.equal(discover(badCost).queued.length, 1);
  const costFailure = respond(badCost, { actionId: "invalid-soul-blast", soul: [badCost.soul[0].uid, "forged-soul"] });
  assert.equal(costFailure.ok, false);
  assert.equal(badCost.state.players.human.soul.length, 2);
  assert.deepEqual(badCost.state.players.human.damage.map(card => card.faceDown), [true, true]);
});
