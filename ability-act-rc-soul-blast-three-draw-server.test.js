"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [{ cardId: "cfa-12553", abilityId: "cfa-12553:2" }, { cardId: "cfa-8405", abilityId: "cfa-8405:1" }];
const TEXT = "ACT [RC] 1/Turn: COST [Soul Blast 3], and draw a card.";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function setup(side = "bot", soulCount = 3) {
  const playerId = side === "bot" ? "guest-player" : "host-player", definition = catalog.find(card => card.id === FAMILY[0].cardId);
  const source = { uid: `source-${side}`, cardId: FAMILY[0].cardId, ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "rear-guard", circle: "rear-left" };
  const player = { playerId, vanguard: { uid: `vg-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: playerId, controllerPlayerId: playerId },
    rear: [source, null, null, null, null], soul: Array.from({ length: soulCount }, (_, i) => ({ uid: `soul-${side}-${i}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId })),
    drop: [], damage: [], hand: [], deck: [{ uid: `deck-${side}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId }], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponentId = side === "bot" ? "host-player" : "guest-player";
  const opponent = { playerId: opponentId, vanguard: { uid: `vg-op-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId }, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  return { state: { matchId: "soul-blast-three-draw", stateVersion: 2, processedActionIds: [], turn: 3, phase: 4, side,
    players: side === "bot" ? { human: opponent, bot: player } : { human: player, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null }, source, definition };
}

function activate(state, side, source, actionId = `act-${side}`) {
  const actorAuthUid = side === "bot" ? "auth-guest" : "auth-host";
  return Reducer.applyManualAbilityActivation(state, { actorAuthUid, actionId, expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: `${source.cardId}:${source.cardId === "cfa-12553" ? 2 : 1}`, selection: { costSelections: { cb: [], sb: state.players[side].soul.map(card => card.uid).slice(0, 3), discard: [], reveal: [] } } } }, seats, Engine);
}

test("both catalog ACT definitions preserve exact RC, Soul Blast 3, draw, and once-per-turn limits", () => {
  for (const item of FAMILY) {
    const card = catalog.find(value => value.id === item.cardId), ability = Engine.parseCardAbilities(card).find(value => value.id === item.abilityId);
    assert.ok(card);
    assert.equal(ability.printedText, TEXT);
    assert.equal(ability.definition.source.patternId, "act-rc-soul-blast-three-draw-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 3 }]);
    assert.deepEqual(ability.usageRestriction, { type: "once-per-turn", scope: "ability-instance", reset: "turn" });
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player independently pay their own Soul Blast and draw", () => {
  for (const side of ["human", "bot"]) {
    const { state, source } = setup(side);
    const result = activate(state, side, source);
    assert.equal(result.ok, true, result.reason);
    assert.equal(state.players[side].soul.length, 0);
    assert.equal(state.players[side].drop.length, 3);
    assert.equal(state.players[side].hand.length, 1);
    assert.equal(state.players[side === "bot" ? "human" : "bot"].soul.length, 0);
  }
});

test("unpayable Soul Blast, wrong circle, forged controller, and repeated ACT reject atomically", () => {
  const insufficient = setup("bot", 2);
  let before = JSON.stringify(insufficient.state), result = activate(insufficient.state, "bot", insufficient.source);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unpayable-cost/);
  assert.equal(JSON.stringify(insufficient.state), before);

  const wrongCircle = setup();
  wrongCircle.state.players.bot.rear[0] = null;
  wrongCircle.source.circle = "vanguard";
  wrongCircle.source.zone = "vanguard";
  wrongCircle.state.players.bot.vanguard = wrongCircle.source;
  before = JSON.stringify(wrongCircle.state);
  result = activate(wrongCircle.state, "bot", wrongCircle.source);
  assert.equal(result.ok, false);
  assert.match(result.reason, /wrong-zone/);
  assert.equal(JSON.stringify(wrongCircle.state), before);

  const forged = setup();
  before = JSON.stringify(forged.state);
  result = Reducer.applyManualAbilityActivation(forged.state, { actorAuthUid: "auth-host", actionId: "forged", expectedStateVersion: 2,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: forged.source.uid, abilityId: "cfa-12553:2", selection: {} } }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(forged.state), before);

  const used = setup();
  result = activate(used.state, "bot", used.source);
  assert.equal(result.ok, true, result.reason);
  used.state.stateVersion++;
  before = JSON.stringify(used.state);
  result = activate(used.state, "bot", used.source, "act-bot-again");
  assert.equal(result.ok, false);
  assert.match(result.reason, /once|used|restriction/i);
  assert.equal(JSON.stringify(used.state), before);
});
