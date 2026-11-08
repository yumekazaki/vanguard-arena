"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-9214", "cfa-13430"];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(id, uid, playerId) {
  const definition = catalog.get(String(id));
  assert.ok(definition, `catalog contains ${id}`);
  return {
    uid,
    cardId: String(id),
    cardName: definition.name,
    grade: definition.grade,
    unitCard: definition.type === "Unit",
    ownerPlayerId: playerId,
    controllerPlayerId: playerId
  };
}

function fixture(cardId = IDS[0], side = "human") {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const enemyPlayerId = side === "human" ? "player-guest" : "player-host";
  const source = card(cardId, `source-${cardId}-${side}`, playerId);
  const vanguard = card("cfa-1", `vanguard-${side}`, playerId);
  const enemyVanguard = card("cfa-7", `enemy-vanguard-${side}`, enemyPlayerId);
  const blank = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: blank("player-host"), bot: blank("player-guest") };
  players[side].vanguard = vanguard;
  players[side].rear[0] = source;
  players[side === "human" ? "bot" : "human"].vanguard = enemyVanguard;
  const definition = catalog.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.kind === "ACT" && item.definition?.source?.patternId === "act-rc-rest-source-choose-vanguard-power-turn-v1");
  assert.ok(ability, `${cardId} has the expected ACT ability`);
  return {
    state: { matchId: "act-rest-source-vanguard-power", stateVersion: 1, processedActionIds: [], turn: 2, phase: 4, side, players },
    source, vanguard, enemyVanguard, ability, side
  };
}

function activate(f, targetUid = f.vanguard.uid, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `activate-${f.state.stateVersion}`) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: auth,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      sourceCardInstanceId: f.source.uid,
      abilityId: f.ability.id,
      selection: { targetUid }
    }
  }, seats, Engine);
}

test("the exact ACT compiler preserves the RC rest cost, Vanguard target, and end-of-turn power", () => {
  const exactByCard = {
    "cfa-9214": "ACT [RC]: COST [Rest this unit], choose one of your vanguards, and it gets power +5000 until end of turn.",
    "cfa-13430": "ACT [RC]: COST [rest this unit], choose one of your vanguards, and it gets power +5000 until end of turn."
  };
  for (const id of IDS) {
    const f = fixture(id);
    const ability = f.ability;
    assert.equal(ability.id, id === "cfa-9214" ? "cfa-9214:0" : "cfa-13430:1");
    assert.equal(ability.printedText, exactByCard[id]);
    assert.equal(ability.kind, "ACT");
    assert.equal(ability.definition?.source?.patternId, "act-rc-rest-source-choose-vanguard-power-turn-v1");
    assert.equal(ability.definition.activationWindow, "main");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "rest-source", count: 1 }]);
    assert.deepEqual(ability.effects, [{ op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" } }]);
    assert.equal(ability.once, false);
    assert.equal(ability.definition.optional, false);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }

  const fideGaon = Engine.parseCardAbilitiesCached(catalog.get("cfa-9214"))[0];
  assert.equal(fideGaon.definition.source.dataset, "Bushiroad official card list");
  assert.equal(fideGaon.definition.source.officialCardNumber, "D-PR/042EN");
  assert.equal(fideGaon.definition.source.officialTextVerified, true);
  assert.equal(fideGaon.definition.source.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F042EN");
  const onoskelis = Engine.parseCardAbilitiesCached(catalog.get("cfa-13430")).find(item => item.id === "cfa-13430:1");
  assert.equal(onoskelis.definition.source.officialTextVerified, false, "local catalog wording is not mislabeled as official verification");
});

test("host and joining player may activate the ACT and only their own Vanguard receives power", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.source.rested, true, "the exact source pays Rest this unit");
    assert.equal(f.vanguard.turnPowerBoost, 5000);
    assert.equal(f.vanguard.turnPowerExpiry, f.state.players[side].playerId);
    assert.equal(f.enemyVanguard.turnPowerBoost, undefined, "the opponent's Vanguard is unchanged");
  }
});

test("invalid source, target, phase, cost state, and forged player identity are rejected without partial changes", () => {
  const wrongTarget = fixture();
  const rearTarget = card("cfa-1", "friendly-rear-target", "player-host");
  wrongTarget.state.players.human.rear[1] = rearTarget;
  const beforeTarget = JSON.stringify(wrongTarget.state);
  assert.equal(activate(wrongTarget, rearTarget.uid).ok, false);
  assert.equal(JSON.stringify(wrongTarget.state), beforeTarget);

  const opponentTarget = fixture();
  const beforeOpponent = JSON.stringify(opponentTarget.state);
  assert.equal(activate(opponentTarget, opponentTarget.enemyVanguard.uid).ok, false);
  assert.equal(JSON.stringify(opponentTarget.state), beforeOpponent);

  const restedSource = fixture();
  restedSource.source.rested = true;
  restedSource.source.position = "rest";
  const beforeRested = JSON.stringify(restedSource.state);
  assert.equal(activate(restedSource).ok, false);
  assert.equal(JSON.stringify(restedSource.state), beforeRested);

  const wrongZone = fixture();
  wrongZone.state.players.human.rear[0] = null;
  wrongZone.state.players.human.hand.push(wrongZone.source);
  const beforeZone = JSON.stringify(wrongZone.state);
  assert.equal(activate(wrongZone).ok, false);
  assert.equal(JSON.stringify(wrongZone.state), beforeZone);

  const wrongPhase = fixture();
  wrongPhase.state.phase = 3;
  const beforePhase = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase).ok, false);
  assert.equal(JSON.stringify(wrongPhase.state), beforePhase);

  const forged = fixture(IDS[0], "bot");
  const beforeForged = JSON.stringify(forged.state);
  assert.equal(activate(forged, forged.vanguard.uid, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(forged.state), beforeForged);
});

test("the ability is not once per turn and may be reused after another effect stands its source", () => {
  const f = fixture();
  const first = activate(f, f.vanguard.uid, seats.hostAuthUid, "first-activation");
  assert.equal(first.ok, true, first.reason);
  f.source.rested = false;
  f.source.position = "stand";
  const second = activate(f, f.vanguard.uid, seats.hostAuthUid, "second-activation");
  assert.equal(second.ok, true, second.reason);
  assert.equal(f.vanguard.turnPowerBoost, 10000);
});
