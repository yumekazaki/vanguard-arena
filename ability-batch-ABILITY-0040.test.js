"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const definitions = require("./ability-contributions/batch-ABILITY-0040.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [card.id, card]));
const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === "ABILITY-0040");
const aliases = definitions.filter(item => item.source.patternId === "cont-card-name-alias-v1");
const shields = definitions.filter(item => item.source.patternId === "cont-gc-opponent-grade-shield-v1");
const zones = ["deck", "hand", "vanguard", "rear-guard", "guardian", "soul", "drop", "bind", "damage", "trigger-zone", "order"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;
const auth = side => side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
const abilityFor = definition => Engine.parseCardAbilitiesCached(byId.get(definition.cardId)).find(item => item.id === definition.id);

function guardFixture(definition, side = "human", opponentGrade = 3) {
  const other = side === "human" ? "bot" : "human";
  const pid = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const unit = (cardId, uid, playerId, extra = {}) => {
    const row = byId.get(cardId);
    return { uid, cardId, cardName: row.name, type: row.type, unitCard: true, grade: row.grade,
      power: row.power, shield: row.shield, critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
  };
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [],
    drop: [], bind: [], damage: [], guardCircle: [], orders: [], triggerZone: [], gZone: [], gDeck: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const n = ++sequence;
  const source = unit(definition.cardId, `guardian-${n}`, pid);
  const sameCardCopy = unit(definition.cardId, `other-copy-${n}`, pid);
  const wrongPlayerCopy = unit(definition.cardId, `opponent-copy-${n}`, opponentId);
  players[side].hand = [source, sameCardCopy];
  players[other].hand = [wrongPlayerCopy];
  players[side].vanguard = unit("cfa-100", `defender-${n}`, pid, { grade: 3 });
  players[other].vanguard = unit("cfa-100", `attacker-${n}`, opponentId, { grade: opponentGrade });
  const state = { matchId: "batch-ABILITY-0040", stateVersion: 7, eventSequence: 0, turn: 4, phase: "battle", side: other,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players, pendingAttack: { battleId: `battle-${n}`, attackerSide: other,
      attackerPlayerId: opponentId, attackerUid: players[other].vanguard.uid, attackerZone: "vanguard",
      defenderSide: side, targetUid: players[side].vanguard.uid, targetZone: "vanguard", power: 23000,
      targetPower: 10000, critical: 1, guardCards: [], defenderDone: false } };
  return { state, source, sameCardCopy, wrongPlayerCopy, side, other, pid, definition };
}
function guard(f, overrides = {}, payload = {}) {
  return Reducer.applyGameAction(f.state, { actorAuthUid: auth(f.side), actionId: `guard-${++sequence}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "game-action", action: "guard",
      cardInstanceId: f.source.uid, ...payload }, ...overrides }, seats, Engine);
}
function rejectsUnchanged(f, overrides, payload) {
  const before = JSON.stringify(f.state);
  const result = guard(f, overrides, payload);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(JSON.stringify(f.state), before, "invalid request leaves canonical state unchanged");
}

test("all 24 exact definitions belong to ABILITY-0040; registration is compatible and all printed blocks remain separate", () => {
  assert.equal(aliases.length, 14);
  assert.equal(shields.length, 10);
  assert.equal(definitions.length, 24);
  assert.equal(new Set(definitions.map(item => item.id)).size, 24);
  for (const definition of definitions) {
    assert.ok(batch.abilityIds.includes(definition.id), definition.id);
    const card = byId.get(definition.cardId);
    const abilities = Engine.parseCardAbilitiesCached(card);
    const ability = abilities.find(item => item.id === definition.id);
    assert.equal(ability.printedText, definition.printedText, definition.id);
    assert.deepEqual(ability.definition, definition, definition.id);
    assert.equal(ability.kind, "CONT");
    assert.equal(Engine.isManuallyActivatable(ability), false);
    assert.equal(ability.trigger, null);
    assert.equal(abilities.length, batch.abilityIds.filter(id => id.startsWith(`${card.id}:`)).length);
  }
  assert.doesNotThrow(() => Engine.registerAbilityDefinitions(definitions), "identical definitions are idempotent");
});

test("cfa-11091:0 stays out of the contribution because its literal alias lacks the catalog counterpart's comma", () => {
  assert.equal(definitions.some(item => item.id === "cfa-11091:0"), false);
  const card = byId.get("cfa-11091");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-11091:0");
  assert.equal(ability.printedText, 'CONT: This card is also regarded as "Serene Maiden Lena".');
  assert.equal(byId.get("cfa-9375").name, "Serene Maiden, Lena");
  assert.equal(Engine.cardsShareName(card, byId.get("cfa-9375")), false, "document literal baseline mismatch without guessing a correction");
});

for (const definition of aliases) {
  test(`${definition.id}: exact alternate name remains active in every zone without changing identity or granting other aliases`, () => {
    const card = byId.get(definition.cardId);
    const alias = definition.printedText.match(/also regarded as "([^"]+)"/)[1];
    const canonical = catalog.find(item => item.name === alias);
    assert.ok(canonical, `catalog counterpart ${alias}`);
    const instance = { uid: `instance-${card.id}`, cardId: card.id, cardName: card.name };
    const before = JSON.stringify(instance);
    for (const location of zones) {
      assert.deepEqual(Engine.getCardNames(card, { location }), [card.name, alias]);
      assert.deepEqual(Engine.getCardNames(instance, { location }), [card.name, alias]);
      assert.equal(Engine.cardHasName(instance, alias, { location }), true);
      assert.equal(Engine.cardHasName(instance, alias.toLowerCase(), { location }), true);
      assert.equal(Engine.cardHasName(instance, `${alias} extra`, { location }), false);
      assert.equal(Engine.cardHasName(instance, alias.slice(0, -1), { location }), false);
      assert.equal(Engine.cardsShareName(card, canonical, { leftLocation: location, rightLocation: location }), true);
      assert.equal(Engine.cardsShareName(canonical, card, { leftLocation: location, rightLocation: location }), true);
      assert.equal(Engine.matchesTargetFilter({ cardName: alias }, { targetCard: instance, targetLocation: location }), true);
      assert.equal(Engine.matchesTargetFilter({ cardName: `${alias} extra` }, { targetCard: instance, targetLocation: location }), false);
      const unrelated = byId.get("cfa-100");
      assert.equal(Engine.cardHasName(unrelated, alias, { location }), false);
      assert.equal(Engine.cardsShareName(card, unrelated), false);
    }
    assert.equal(JSON.stringify(instance), before, "name checks must not rewrite UID or printed name");
    assert.equal(Engine.evaluateContinuousShieldEffects([abilityFor(definition)], { location: "guardian", opponentVanguardGrade: 3 }).shield, 0);
  });
}

for (const definition of shields) {
  test(`${definition.id}: shield is exactly 5000 on GC against grade 3+, zero elsewhere, and evaluation never stores a bonus`, () => {
    const ability = abilityFor(definition);
    assert.deepEqual(ability.requiredLocation, ["guardian"]);
    const before = JSON.stringify(ability);
    for (const grade of [3, 4, 5]) assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: grade }).shield, 5000);
    for (const grade of [-1, 0, 1, 2, undefined]) assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: grade }).shield, 0);
    for (const location of zones.filter(zone => zone !== "guardian")) assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location, opponentVanguardGrade: 3 }).shield, 0);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", controllerVanguardGrade: 3, opponentVanguardGrade: 2 }).shield, 0, "own Vanguard grade cannot meet the opponent threshold");
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 3 }).shield, 5000);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 2 }).shield, 0, "condition change takes effect without expiry state");
    assert.equal(JSON.stringify(ability), before);
  });

  test(`${definition.id}: authoritative guard selects only the exact instance and adds correct shield for either defending seat`, () => {
    for (const side of ["human", "bot"]) for (const grade of [2, 3, 4]) {
      const f = guardFixture(definition, side, grade);
      const own = f.state.players[side], opponent = f.state.players[f.other];
      const commandId = `accepted-${++sequence}`;
      const result = guard(f, { actionId: commandId }, { shield: 999999, amount: 999999 });
      assert.equal(result.ok, true, result.reason);
      assert.equal(f.state.pendingAttack.targetPower, 10000 + byId.get(definition.cardId).shield + (grade >= 3 ? 5000 : 0));
      assert.deepEqual(own.guardCircle.map(card => card.uid), [f.source.uid]);
      assert.deepEqual(own.hand.map(card => card.uid), [f.sameCardCopy.uid]);
      assert.deepEqual(opponent.hand.map(card => card.uid), [f.wrongPlayerCopy.uid]);
      assert.equal(f.source.battleShieldBoost, undefined, "passive shield must not persist as an AUTO modifier");
      assert.equal((f.state.pendingAbilities || []).filter(item => item.ability?.id === definition.id).length, 0);
      rejectsUnchanged(f, { actionId: commandId });
      rejectsUnchanged(f, {}, { cardInstanceId: f.source.uid });
    }
  });

  test(`${definition.id}: wrong player, UID, zone, ownership, version, and defense timing reject atomically`, () => {
    for (const side of ["human", "bot"]) {
      let f = guardFixture(definition, side);
      rejectsUnchanged(f, { actorAuthUid: auth(f.other) });
      rejectsUnchanged(f, { actorAuthUid: "unseated" });
      rejectsUnchanged(f, { expectedStateVersion: f.state.stateVersion - 1 });
      rejectsUnchanged(f, {}, { cardInstanceId: f.wrongPlayerCopy.uid });
      rejectsUnchanged(f, {}, { cardInstanceId: "missing" });
      f.state.players[side].hand.shift(); f.state.players[side].rear[0] = f.source;
      rejectsUnchanged(f);
      f = guardFixture(definition, side);
      f.source.controllerPlayerId = f.state.players[f.other].playerId;
      rejectsUnchanged(f);
      f = guardFixture(definition, side);
      f.source.ownerPlayerId = f.state.players[f.other].playerId;
      rejectsUnchanged(f);
      f = guardFixture(definition, side);
      f.state.pendingAttack.defenderDone = true;
      rejectsUnchanged(f);
      f = guardFixture(definition, side);
      f.state.pendingAttack = null;
      rejectsUnchanged(f);
    }
  });
}

test("catalog remains at baseline coverage with zero invalid compiled definitions", () => {
  const report = auditCatalog(catalog);
  assert.equal(report.abilityBlocks, 17240);
  assert.equal(report.compiled, 4174, "this contribution adds per-card evidence, not compiler coverage");
  assert.equal(report.unsupported, 13066);
  assert.deepEqual(report.invalidCompiled, []);
});
