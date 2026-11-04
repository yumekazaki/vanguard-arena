"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-11767:1", { cardId: "cfa-11767", cardName: "Ning Sweat16! [2]", soulName: "Proud Sweat16! [2]", amount: 2000 }],
  ["cfa-11769:0", { cardId: "cfa-11769", cardName: "Proud Sweat16! [2]", soulName: "Eh Sweat16! [2]", amount: 1000 }],
  ["cfa-242:0", { cardId: "cfa-242", cardName: "Enigman Ripple", soulName: "Enigman Flow", amount: 2000 }],
  ["cfa-4411:0", { cardId: "cfa-4411", cardName: "Smart Fender Dragon", soulName: "Chic Folk Dracokid", amount: 3000 }]
]);
const cards = loadCatalog();
const compilerDefinitions = new Map();
for (const [id, expected] of FAMILY) {
  const card = cards.find(value => value.id === expected.cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  if (ability?.definition) compilerDefinitions.set(id, ability.definition);
}
const definitions = require("./ability-contributions/batch-CANDIDATE-C0086556-0014.js");
Engine.registerAbilityDefinitions(definitions);
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function buildFixture({ abilityId, side = "human", soulName = null, opponentSoulName = null, sourceZone = "vanguard" }) {
  const expected = FAMILY.get(abilityId), card = cards.find(value => value.id === expected.cardId);
  assert.ok(card, expected.cardId);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const unit = (uid, cardId, cardName, playerId, grade = 3, power = 13000) => ({
    uid, cardId, cardName, type: "Normal Unit", unitCard: true, grade, power, critical: 1,
    drive: 1, rested: false, locked: false, ownerPlayerId: playerId, controllerPlayerId: playerId
  });
  const source = unit(`source-${side}-${abilityId}`, card.id, expected.cardName, ownerId, Number(card.grade), Number(card.power));
  const ownVanguard = sourceZone === "vanguard" ? source : unit(`own-vg-${side}`, "fixture-vanguard", "Fixture Vanguard", ownerId);
  const opponentVanguard = unit(`opp-vg-${side}`, "opponent-vanguard", "Opponent Vanguard", opponentId);
  const makeSoul = (playerId, name, tag) => name ? [{ uid: `${tag}-${side}-${abilityId}`, cardId: `${tag}-soul`, cardName: name, ownerPlayerId: playerId, controllerPlayerId: playerId }] : [];
  const player = (playerId, vanguard, soul = [], rear = []) => ({
    playerId, vanguard, rear, soul, deck: [], hand: [], damage: [], drop: [], bind: [],
    orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  });
  const owner = player(ownerId, ownVanguard, makeSoul(ownerId, soulName, "own"), sourceZone === "vanguard" ? [] : [source, null, null, null, null]);
  const opponent = player(opponentId, opponentVanguard, makeSoul(opponentId, opponentSoulName, "opponent"));
  const state = {
    matchId: `named-soul-${side}-${abilityId}-${sourceZone}`,
    stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true,
    processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    authoritySeats: { hostSide: "human", guestSide: "bot" }, players: { [side]: owner, [opponentSide]: opponent }
  };
  const command = {
    actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`, expectedStateVersion: 0,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opponentVanguard.uid }
  };
  return { state, command, source, owner, opponent, expected };
}

test("the four exact Soul-name Vanguard CONT abilities preserve card IDs, text, circle, and amount", () => {
  assert.equal(definitions.length, FAMILY.size);
  for (const [id, expected] of FAMILY) {
    const card = cards.find(value => value.id === expected.cardId);
    assert.ok(card, id);
    const parsed = Engine.parseCardAbilitiesCached(card);
    const ability = parsed.find(item => item.id === id);
    const definition = definitions.find(item => item.id === id);
    assert.ok(ability, id);
    const compilerDefinition = compilerDefinitions.get(id);
    assert.ok(compilerDefinition, `${id} compiles without curated registration`);
    assert.equal(compilerDefinition.printedText, definition.printedText, `${id} compiler retains exact text`);
    assert.deepEqual(compilerDefinition.effects, definition.effects, `${id} compiler derives exact effect`);
    assert.deepEqual(compilerDefinition.requiredLocation, ["vanguard"], `${id} compiler enforces printed circle`);
    assert.equal(ability.kind, "CONT", id);
    assert.equal(ability.printedText, definition.printedText, id);
    assert.equal(ability.definition?.source?.patternId, "cont-named-soul-card-power-v1", id);
    assert.deepEqual(ability.requiredLocation, ["vanguard"], id);
    assert.equal(ability.definition.effects[0].op, "continuous-power", id);
    assert.equal(ability.definition.effects[0].target, "source", id);
    assert.equal(ability.definition.effects[0].amount, expected.amount, id);
    assert.equal(ability.definition.effects[0].duration, "continuous", id);
    assert.deepEqual(ability.definition.effects[0].condition, { op: "soul-has-card-name", name: expected.soulName, controllerTurn: false }, id);
    assert.equal(Engine.isManuallyActivatable(ability), false, id);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, false, id);
  }
  const report = auditCatalog(cards);
  assert.deepEqual(report.invalidCompiled.filter(item => FAMILY.has(item.abilityId)), []);
  assert.ok(report.patterns["cont-named-soul-card-power-v1"] >= FAMILY.size);
  assert.equal(Engine.parseCardAbilitiesCached(cards.find(item => item.id === "cfa-11767")).find(item => item.id === "cfa-11767:0").definition, null);
  assert.equal(Engine.parseCardAbilitiesCached(cards.find(item => item.id === "cfa-4411")).find(item => item.id === "cfa-4411:1").definition, null);
  assert.equal(Engine.parseCardAbilitiesCached(cards.find(item => item.id === "cfa-8142")).find(item => item.id === "cfa-8142:0").definition, null, "the unassigned VC/RC variant remains outside this VC-only batch");
});

test("CONT checks this unit's exact source instance, its printed circle, and the controller's Soul only", () => {
  for (const side of ["host", "joining player"]) for (const [id, expected] of FAMILY) {
    const ability = Engine.parseCardAbilitiesCached(cards.find(card => card.id === expected.cardId)).find(item => item.id === id);
    const evaluate = (location, soulCardNames, sourceInstanceId = `source-${side}`, targetInstanceId = `source-${side}`) => Engine.evaluateContinuousEffects([ability], {
      location, sourceLocation: location, sourceInstanceId, targetInstanceId, soulCardNames, isControllerTurn: false
    }).power;
    assert.equal(evaluate("vanguard", [expected.soulName]), expected.amount, `${side}/${id}: own named Soul applies`);
    assert.equal(evaluate("vanguard", [expected.soulName.toLowerCase()]), expected.amount, `${side}/${id}: name comparison is case-insensitive`);
    assert.equal(evaluate("vanguard", []), 0, `${side}/${id}: missing Soul card rejects`);
    assert.equal(evaluate("vanguard", [`Different ${expected.soulName}`]), 0, `${side}/${id}: partial/wrong name rejects`);
    assert.equal(evaluate("rear-guard", [expected.soulName]), 0, `${side}/${id}: wrong circle rejects`);
    assert.equal(evaluate("guardian", [expected.soulName]), 0, `${side}/${id}: Guardian Circle rejects`);
    assert.equal(evaluate("vanguard", [expected.soulName], "other-source", "source-${side}"), 0, `${side}/${id}: a different source instance cannot receive this bonus`);
  }
});

test("authoritative attack power uses the owning player's Soul for either online seat", () => {
  for (const side of ["human", "bot"]) for (const [id, expected] of FAMILY) {
    const f = buildFixture({ abilityId: id, side, soulName: expected.soulName });
    const outcome = Reducer.applyGameAction(f.state, f.command, SEATS, Engine);
    assert.equal(outcome.ok, true, `${side}/${id}: ${outcome.reason}`);
    assert.equal(outcome.state.pendingAttack.power, Number(f.source.power) + expected.amount, `${side}/${id}: owning player's Soul grants only the printed bonus`);
  }
});

test("an opponent's matching Soul and a wrong Rear-Guard location do not grant the Vanguard bonus", () => {
  for (const side of ["human", "bot"]) for (const [id, expected] of FAMILY) {
    const wrongSoul = buildFixture({ abilityId: id, side, opponentSoulName: expected.soulName });
    const wrongSoulOutcome = Reducer.applyGameAction(wrongSoul.state, wrongSoul.command, SEATS, Engine);
    assert.equal(wrongSoulOutcome.ok, true, `${side}/${id} opponent Soul action: ${wrongSoulOutcome.reason}`);
    assert.equal(wrongSoulOutcome.state.pendingAttack.power, Number(wrongSoul.source.power), `${side}/${id}: opponent Soul is private to and checked only for its controller`);

    const wrongCircle = buildFixture({ abilityId: id, side, soulName: expected.soulName, sourceZone: "rear-guard" });
    const wrongCircleOutcome = Reducer.applyGameAction(wrongCircle.state, wrongCircle.command, SEATS, Engine);
    assert.equal(wrongCircleOutcome.ok, true, `${side}/${id} Rear-Guard attack: ${wrongCircleOutcome.reason}`);
    assert.equal(wrongCircleOutcome.state.pendingAttack.power, Number(wrongCircle.source.power), `${side}/${id}: VC-only modifier does not apply on RC`);
  }
});

test("unmodeled sibling effects remain unsupported instead of receiving partial definitions", () => {
  const expected = new Map([
    ["cfa-11767:0", {
      cardId: "cfa-11767",
      text: "ACT [VC] Limit Break 4: COST [Counter Blast 2], this unit gets power +5000 until end of turn, search your deck for up to two <Iconic> cards, call them to RC, shuffle your deck."
    }],
    ["cfa-4411:1", {
      cardId: "cfa-4411",
      text: 'CONT [RC]: If you have "Chic Folk Dracokid" in your soul, this unit gets power +1000 / grade +1.'
    }]
  ]);
  for (const [id, item] of expected) {
    const card = cards.find(value => value.id === item.cardId);
    const abilities = Engine.parseCardAbilitiesCached(card);
    const ability = abilities.find(value => value.id === id);
    assert.ok(ability, id);
    assert.equal(ability.printedText, item.text, `${id}: exact catalog text remains attached`);
    assert.equal(ability.definition, null, `${id}: no incomplete handler is registered`);
    if (ability.kind === "ACT") {
      assert.deepEqual(Engine.canActivateManualAbility(ability, {}), { ok: false, reason: "unsupported-effect" }, id);
    } else {
      assert.equal(ability.conditionStatus, "needs-review", id);
    }
  }
});
