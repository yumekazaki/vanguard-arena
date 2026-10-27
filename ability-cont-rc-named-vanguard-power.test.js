"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-named-vanguard-power-v1";
const cards = loadCatalog();
const EXPECTED = new Map([
  ["cfa-4366:1", ["Daiyusha", 2000]],
  ["cfa-4366:2", ["Daikaiser", 2000]],
  ["cfa-5259:1", ["Gaia", 2000]],
  ["cfa-7869:0", ["Blaster", 5000]],
  ["cfa-9298:0", ["Seraph", 5000]]
]);

test("five exact catalog CONT abilities keep their printed Vanguard name, circle, and power values", () => {
  const audit = auditCatalog(cards), found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    found.set(ability.id, { card, ability });
  }
  assert.deepEqual([...found.keys()].sort(), [...EXPECTED.keys()].sort());
  assert.equal(audit.patterns[PATTERN], EXPECTED.size);
  for (const [id, [name, amount]] of EXPECTED) {
    const { card, ability } = found.get(id);
    assert.equal(ability.kind, "CONT", id);
    assert.equal(ability.trigger, null, id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], id);
    assert.equal(ability.definition.effects.length, 1, id);
    const effect = ability.definition.effects[0];
    assert.equal(effect.op, "continuous-power", id);
    assert.equal(effect.target, "source", id);
    assert.equal(effect.amount, amount, id);
    assert.equal(effect.duration, "continuous", id);
    assert.deepEqual(effect.condition, { op: "controller-vanguard-card-name-contains", name }, id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === id && item.source.patternId === PATTERN), id);
  }
  assert.deepEqual(audit.invalidCompiled, []);
});

test("named Vanguard CONT power follows each controller on either turn and only on RC", () => {
  for (const side of ["human", "bot"]) for (const [id, [name, amount]] of EXPECTED) {
    const { ability } = Engine.parseCardAbilitiesCached(cards.find(card => card.id === id.split(":")[0]))
      .map(item => ({ ability: item })).find(item => item.ability.id === id);
    const evaluate = (location, controllerVanguardCardNames, isControllerTurn = false) => Engine.evaluateContinuousEffects([ability], {
      location, sourceInstanceId: `source-${side}`, targetInstanceId: `source-${side}`,
      controllerVanguardCardNames, isControllerTurn
    }).power;
    assert.equal(evaluate("rear-guard", [`Example ${name} Vanguard`]), amount, `${side}/${id} applies on opponent turn`);
    assert.equal(evaluate("rear-guard", [`Example ${name} Vanguard`], true), amount, `${side}/${id} applies on controller turn`);
    assert.equal(evaluate("rear-guard", ["Unrelated Vanguard"]), 0, `${side}/${id} rejects wrong name`);
    assert.equal(evaluate("rear-guard", []), 0, `${side}/${id} rejects missing Vanguard`);
    assert.equal(evaluate("vanguard", [`Example ${name} Vanguard`]), 0, `${side}/${id} rejects VC`);
    assert.equal(evaluate("guardian", [`Example ${name} Vanguard`]), 0, `${side}/${id} rejects GC`);
  }
});

test("trusted battle power applies the named-Vanguard CONT bonus for host and joining-player Rear-Guards", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const player = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) {
    const owner = side === "human" ? "host" : "guest", opponentSide = side === "human" ? "bot" : "human", opponent = side === "human" ? "guest" : "host";
    const source = { uid: `source-${side}`, cardId: "cfa-7869", cardName: "Blaster unit", type: "Normal Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const friendlyVanguard = { uid: `friendly-vg-${side}`, cardId: "friendly-vg", cardName: "Example Blaster Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const opposingVanguard = { uid: `opposing-vg-${side}`, cardId: "opposing-vg", cardName: "Opponent Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: opponent, controllerPlayerId: opponent };
    const state = { matchId: `named-cont-${side}`, stateVersion: 0, turn: 3, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
    state.players[side] = player(owner, friendlyVanguard, [source, null, null, null, null]);
    state.players[opponentSide] = player(opponent, opposingVanguard);
    const outcome = Reducer.applyGameAction(state, {
      actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `named-cont-attack-${side}`, expectedStateVersion: 0,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid }
    }, seats, Engine);
    assert.equal(outcome.ok, true, outcome.reason);
    assert.equal(outcome.state.pendingAttack.power, 15000, `${side} source uses its controller's matching Vanguard CONT`);
  }
});

test("continuous named-Vanguard abilities never enter the AUTO prompt queue", () => {
  const card = cards.find(item => item.id === "cfa-7869");
  const source = { uid: "source", cardId: card.id, ownerPlayerId: "host", controllerPlayerId: "host" };
  const state = { side: "human", turn: 1, players: {
    human: { playerId: "host", vanguard: null, rear: [source], guardCircle: [], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], triggerZone: [] },
    bot: { playerId: "guest", vanguard: null, rear: [], guardCircle: [], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], triggerZone: [] }
  }, pendingAbility: null, pendingAbilities: [] };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: "host", turnPlayerId: "host", sourceCardInstanceId: source.uid, subjectCardInstanceId: source.uid, sourceControllerPlayerId: "host", subjectControllerPlayerId: "host" });
  assert.deepEqual(Reducer.discoverAutoTriggers(state, [event], Engine).queued, []);
  assert.equal(state.pendingAbility, null);
});
