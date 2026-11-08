"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-11770", "cfa-11772"];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(id, uid, playerId) {
  const definition = catalog.get(String(id));
  assert.ok(definition, `fixture card ${id} exists in the catalog`);
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

function fixture(cardId = IDS[0], side = "human", zone = "rear-guard", faceUpDamage = 2) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const enemyPlayerId = side === "human" ? "player-guest" : "player-host";
  const source = card(cardId, `source-${cardId}-${side}-${zone}`, playerId);
  const target = card("cfa-1", `ally-${side}`, playerId);
  const enemy = card("cfa-7", `enemy-${side}`, enemyPlayerId);
  const damage = Array.from({ length: faceUpDamage }, (_, index) => ({
    uid: `damage-${side}-${index}`, cardId: "cfa-1", faceDown: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId
  }));
  const blank = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: blank("player-host"), bot: blank("player-guest") };
  if (zone === "vanguard") {
    players[side].vanguard = source;
    players[side].rear[0] = target;
  } else {
    players[side].vanguard = target;
    players[side].rear[0] = source;
  }
  players[side === "human" ? "bot" : "human"].vanguard = enemy;
  players[side].damage = damage;
  const definition = catalog.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 is parsed`);
  return {
    state: { matchId: "act-friendly-unit-counter-blast", stateVersion: 1, processedActionIds: [], turn: 2, phase: 4, side, players },
    source, target, enemy, damage, ability, side
  };
}

function activate(f, targetUid = f.target.uid, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `activate-${f.state.stateVersion}`) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: auth,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      sourceCardInstanceId: f.source.uid,
      abilityId: f.ability.id,
      selection: {
        targetUid,
        costSelections: { cb: f.damage.filter(item => !item.faceDown).slice(0, 1).map(item => item.uid), sb: [], discard: [], reveal: [] }
      }
    }
  }, seats, Engine);
}

test("both exact ACT cards are trusted, VC/RC legal, and have no once-per-turn restriction", () => {
  for (const id of IDS) {
    const f = fixture(id);
    const definition = Engine.getReviewedAbilityDefinitionsForCard(id).find(item => item.id === f.ability.id);
    assert.ok(definition, `${id}:1 is registered as trusted`);
    assert.equal(f.ability.printedText, "ACT [VC/RC]: COST [Counter Blast 1], choose one of your units, it gets power +4000 until end of turn.");
    assert.equal(f.ability.kind, "ACT");
    assert.equal(f.ability.definition.source.patternId, "act-vc-rc-counter-blast-choose-friendly-unit-power-turn-v1");
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(f.ability.definition.activationWindow, "main");
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(f.ability.once, false);
    assert.equal(f.ability.definition.optional, false);
    assert.deepEqual(f.ability.effects, [{ op: "modify-power-target", target: "chosen", amount: 4000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit" } }]);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player activate from VC or RC and only boost a selected friendly unit", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-guard"]) {
    const f = fixture(id, side, zone);
    const result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}/${zone}: ${result.reason}`);
    assert.equal(f.damage[0].faceDown, true, "the activating player pays Counter Blast");
    assert.equal(f.target.turnPowerBoost, 4000);
    assert.equal(f.target.turnPowerExpiry, f.state.players[side].playerId);
    assert.equal(f.enemy.turnPowerBoost, undefined, "the opponent's unit is unchanged");
  }
});

test("the source is a legal target because the text allows any of your units", () => {
  const f = fixture(IDS[0], "human", "vanguard");
  const result = activate(f, f.source.uid);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.source.turnPowerBoost, 4000);
  assert.equal(f.target.turnPowerBoost, undefined);
});

test("repeat use is allowed while paid costs, illegal targets, timing, location, and forged ownership are enforced atomically", () => {
  const repeated = fixture(IDS[1], "bot", "rear-guard", 2);
  assert.equal(activate(repeated).ok, true);
  const second = activate(repeated, repeated.target.uid, seats.guestAuthUid, "second-use");
  assert.equal(second.ok, true, second.reason);
  assert.equal(repeated.damage.filter(item => item.faceDown).length, 2);
  assert.equal(repeated.target.turnPowerBoost, 8000);

  const insufficient = fixture(IDS[0], "human", "rear-guard", 0);
  const beforeInsufficient = JSON.stringify(insufficient.state);
  assert.equal(activate(insufficient).ok, false);
  assert.equal(JSON.stringify(insufficient.state), beforeInsufficient);

  const opponentTarget = fixture();
  const beforeTarget = JSON.stringify(opponentTarget.state);
  assert.equal(activate(opponentTarget, opponentTarget.enemy.uid).ok, false);
  assert.equal(JSON.stringify(opponentTarget.state), beforeTarget);
  assert.equal(activate(opponentTarget, null).ok, false);
  assert.equal(JSON.stringify(opponentTarget.state), beforeTarget);

  const wrongPhase = fixture();
  wrongPhase.state.phase = 3;
  const beforePhase = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase).ok, false);
  assert.equal(JSON.stringify(wrongPhase.state), beforePhase);

  const wrongZone = fixture();
  wrongZone.state.players.human.rear[0] = null;
  wrongZone.state.players.human.hand.push(wrongZone.source);
  const beforeZone = JSON.stringify(wrongZone.state);
  assert.equal(activate(wrongZone).ok, false);
  assert.equal(JSON.stringify(wrongZone.state), beforeZone);

  const forged = fixture(IDS[0], "bot");
  const beforeForged = JSON.stringify(forged.state);
  assert.equal(activate(forged, forged.target.uid, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(forged.state), beforeForged);
});
