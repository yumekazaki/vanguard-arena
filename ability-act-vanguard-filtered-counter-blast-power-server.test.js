"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1317", "Ancient Dragon"], ["cfa-1564", "Magus"],
  ["cfa-1566", "Battle Sister"], ["cfa-1946", "Duo"]
]);
const catalog = loadCatalog(process.cwd());
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function instance(cardId, uid) {
  const card = catalogById.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || "", ownerPlayerId: "", controllerPlayerId: "" };
}

function setup(cardId, side = "bot", matching = 2, includeWrong = false) {
  const playerId = side === "bot" ? "guest-player" : "host-player";
  const source = instance(cardId, `source-${side}`);
  source.ownerPlayerId = playerId;
  source.controllerPlayerId = playerId;
  const namePart = FAMILY.get(cardId);
  const matchingCatalogCards = catalog.filter(card => String(card.name || "").toLowerCase().includes(namePart.toLowerCase()));
  assert.ok(matchingCatalogCards.length >= matching, `catalog has enough ${namePart} cards`);
  const damage = matchingCatalogCards.slice(0, matching).map((card, index) => {
    const paid = instance(card.id, `matching-${side}-${index}`);
    paid.ownerPlayerId = playerId;
    paid.controllerPlayerId = playerId;
    paid.zone = "damage";
    return paid;
  });
  if (includeWrong) {
    const otherCard = catalog.find(card => !String(card.name || "").toLowerCase().includes(namePart.toLowerCase()));
    const wrong = instance(otherCard.id, `wrong-${side}`);
    wrong.ownerPlayerId = playerId;
    wrong.controllerPlayerId = playerId;
    wrong.zone = "damage";
    damage.push(wrong);
  }
  const player = { playerId, vanguard: source, rear: Array(5).fill(null), soul: [], drop: [], damage, hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponentId = side === "bot" ? "host-player" : "guest-player";
  const opponent = { playerId: opponentId, vanguard: { ...instance("cfa-3", `opponent-vg-${side}`), ownerPlayerId: opponentId, controllerPlayerId: opponentId }, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  return { source, matchingUids: damage.slice(0, matching).map(card => card.uid), wrongUid: damage[matching]?.uid,
    state: { matchId: "filtered-counter-blast-act", stateVersion: 2, processedActionIds: [], turn: 3, phase: 4, side,
      players: side === "bot" ? { human: opponent, bot: player } : { human: player, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null } };
}

function activate(state, side, source, selectedUids, actionId = `act-${side}`) {
  return Reducer.applyManualAbilityActivation(state, {
    actorAuthUid: side === "bot" ? "auth-guest" : "auth-host", actionId, expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: `${source.cardId}:1`,
      selection: { costSelections: { cb: selectedUids, sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("all four exact printed Vanguard ACT abilities compile their card-name Counter Blast filter", () => {
  for (const [cardId, name] of FAMILY) {
    const card = catalogById.get(cardId);
    const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:1`);
    assert.ok(ability, `${cardId} ability found`);
    assert.equal(ability.printedText, `ACT [VC]: [Counter Blast 2-card with "${name}" in its card name] This unit gets power +5000 until end of turn.`);
    assert.equal(ability.definition.source.patternId, "act-vanguard-filtered-counter-blast-source-power-turn-v1");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2, filter: { cardNameContains: name } }]);
    assert.equal(ability.costStatus, "supported-cost");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player each pay only matching face-up damage and boost their own Vanguard", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) {
    const { state, source, matchingUids } = setup(cardId, side, 2, true);
    const namePart = FAMILY.get(cardId);
    state.players[side].damage[0].cardName = "Forged Unrelated Name";
    state.players[side].damage[1].cardName = namePart;
    state.players[side].damage[2].cardName = namePart;
    const result = activate(state, side, source, matchingUids);
    assert.equal(result.ok, true, result.reason);
    assert.equal(state.players[side].vanguard.turnPowerBoost, 5000);
    assert.equal(state.players[side].damage.map(card => card.faceDown === true).join(","), "true,true,false");
    assert.equal(state.players[side === "human" ? "bot" : "human"].damage.length, 0);
    const afterResolution = JSON.stringify(state);
    const replay = activate(state, side, source, matchingUids);
    assert.equal(replay.ok, false);
    assert.match(replay.reason, /duplicate-action|stale-state-version/);
    assert.equal(JSON.stringify(state), afterResolution);
  }
});

test("wrong-filter, face-down, unaffordable, wrong-circle, and forged activations reject atomically", () => {
  const { state, source, matchingUids, wrongUid } = setup("cfa-1317", "bot", 2, true);
  const snapshot = JSON.stringify(state);
  let result = activate(state, "bot", source, [matchingUids[0], wrongUid]);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(state), snapshot);

  const facedown = setup("cfa-1317", "bot", 2, true);
  facedown.state.players.bot.damage[0].faceDown = true;
  const facedownSnapshot = JSON.stringify(facedown.state);
  result = activate(facedown.state, "bot", facedown.source, facedown.matchingUids);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(facedown.state), facedownSnapshot);

  const short = setup("cfa-1317", "bot", 1, true);
  const ability = Engine.parseCardAbilities(catalogById.get("cfa-1317")).find(item => item.id === "cfa-1317:1");
  assert.equal(Engine.canActivateManualAbility(ability, { cardInstanceId: short.source.uid, controllerPlayerId: "guest-player", actorPlayerId: "guest-player", turnPlayerId: "guest-player", phase: "main", inPermittedZone: true,
    resources: { faceUpDamage: 2, faceUpDamageCards: short.state.players.bot.damage, cardDefinitionForInstance: card => catalogById.get(card.cardId) } }).reason, "unpayable-cost");
  const shortSnapshot = JSON.stringify(short.state);
  result = activate(short.state, "bot", short.source, short.matchingUids);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unpayable-cost/);
  assert.equal(JSON.stringify(short.state), shortSnapshot);

  const wrongCircle = setup("cfa-1317", "bot", 2, true);
  wrongCircle.state.players.bot.vanguard = null;
  wrongCircle.state.players.bot.rear[0] = wrongCircle.source;
  wrongCircle.source.zone = "rear-guard";
  wrongCircle.source.circle = "rear-left";
  const wrongCircleSnapshot = JSON.stringify(wrongCircle.state);
  result = activate(wrongCircle.state, "bot", wrongCircle.source, wrongCircle.matchingUids);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(wrongCircle.state), wrongCircleSnapshot);

  const forged = setup("cfa-1317", "bot", 2, true);
  const forgedSnapshot = JSON.stringify(forged.state);
  result = Reducer.applyManualAbilityActivation(forged.state, { actorAuthUid: "auth-host", actionId: "forged", expectedStateVersion: 2,
    payload: { sourceCardInstanceId: forged.source.uid, abilityId: "cfa-1317:1", selection: { costSelections: { cb: forged.matchingUids, sb: [], discard: [], reveal: [] } } } }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(forged.state), forgedSnapshot);
});
