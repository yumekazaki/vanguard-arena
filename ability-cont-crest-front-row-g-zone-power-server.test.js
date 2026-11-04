"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const pattern = "cont-crest-own-turn-named-vanguard-front-row-power-per-face-up-g-zone-v1";
const family = new Map([
  ["cfa-10476", { name: "Chronojet", vanguardId: "cfa-2480" }],
  ["cfa-10668", { name: "Messiah", vanguardId: "cfa-2881" }],
  ["cfa-12183", { name: "Luard", vanguardId: "cfa-4226" }],
  ["cfa-13177", { name: "Nightrose", vanguardId: "cfa-3422" }],
  ["cfa-13186", { name: "Harri", vanguardId: "cfa-3280" }]
]);
const seats = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
function definition(id) { return catalog.find(card => card.id === id); }
function instance(id, uid, owner, extra = {}) {
  const card = definition(id);
  return { uid, cardId: id, cardName: card?.name || id, type: card?.type || "Unit", unitCard: true,
    grade: Number(card?.grade || 0), power: Number(card?.power || 0), critical: 1,
    ownerPlayerId: owner, controllerPlayerId: owner, ...extra };
}
function fixture(cardId, side = "human", options = {}) {
  const item = family.get(cardId), ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest-player" : "host-player";
  const vanguardId = options.vanguardId || item.vanguardId;
  const vanguard = instance(vanguardId, `vg-${cardId}-${side}`, ownerId, { circle: "vanguard", zone: "vanguard", rested: false });
  if (options.strideHeartId) vanguard.strideHeart = instance(options.strideHeartId, `heart-${cardId}-${side}`, ownerId, { circle: "vanguard", zone: "soul" });
  const crest = instance(`virtual-crest-${cardId}`, `crest-${cardId}-${side}`, ownerId,
    { type: "Crest", crestName: item.name, crestAbilityCardId: cardId, isCrest: true, zone: "crest" });
  if (options.foreignCrest) crest.controllerPlayerId = opponentId;
  const own = { playerId: ownerId, vanguard, rear: Array(5).fill(null), crests: [crest], gZone: [
    instance("face-up-a", `g-a-${cardId}-${side}`, ownerId, { faceUp: true }),
    instance("face-up-b", `g-b-${cardId}-${side}`, ownerId, { faceUp: true }),
    instance("face-down", `g-down-${cardId}-${side}`, ownerId, { faceUp: false })
  ], hand: [], soul: [], damage: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], removed: [], extra: [], gDeck: [] };
  const opponent = { playerId: opponentId, vanguard: instance("opponent-vanguard", `opp-vg-${cardId}-${side}`, opponentId,
    { circle: "vanguard", zone: "vanguard", grade: 3, power: 13000, critical: 1, rested: false }),
    rear: Array(5).fill(null), crests: [], gZone: [], hand: [], soul: [], damage: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], removed: [], extra: [], gDeck: [] };
  const state = { matchId: `crest-front-row-${cardId}-${side}`, stateVersion: 1, turn: 5, side, phase: 5,
    firstTurnComplete: true, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    pendingAbility: null, pendingTrigger: null, pendingAttack: null,
    players: { [side]: own, [opponentSide]: opponent } };
  const command = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `attack-${state.matchId}`, expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: vanguard.uid, targetCardInstanceId: opponent.vanguard.uid } };
  return { state, command, own, opponent, vanguard, crest, cardId, side };
}
function attack(f) { return Reducer.applyGameAction(f.state, f.command, seats, Engine); }

test("five catalog blocks compile only their exact CONT ability; other card abilities stay independently audited", () => {
  const ids = [...family.keys()];
  let blockCount = 0;
  for (const id of ids) {
    const card = definition(id), abilities = Engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, 4, `${id} has four source ability blocks`);
    blockCount += abilities.length;
    const matches = abilities.filter(ability => ability.definition?.source?.patternId === pattern);
    assert.equal(matches.length, 1, `${id} only compiles the :2 ability`);
    const ability = matches[0];
    assert.equal(ability.id, `${id}:2`);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["crest"]);
    assert.equal(ability.definition.effects[0].op, "continuous-power-per-face-up-g-zone-card");
    assert.equal(ability.definition.effects[0].amount, 5000);
    assert.deepEqual(ability.definition.effects[0].condition, { op: "all", conditions: [
      { op: "controller-turn" }, { op: "controller-vanguard-grade-at-least", grade: 3 },
      { op: "controller-vanguard-card-name-contains", name: family.get(id).name }
    ] });
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    for (const other of abilities.filter(value => value.id !== ability.id)) {
      assert.notEqual(other.definition?.source?.patternId, pattern);
      assert.equal(Boolean(other.definition), false, `${other.id} remains independently unsupported pending its own review`);
    }
  }
  assert.equal(blockCount, 20);
  const audit = auditCatalog(catalog);
  assert.equal(audit.patterns[pattern], 5);
  assert.equal(audit.invalidCompiled.some(item => family.has(item.cardId) && item.abilityId.endsWith(":2")), false);
});

test("the exact crest continuously grants power per distinct face-up G-zone card to both seats", () => {
  for (const cardId of family.keys()) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side), result = attack(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(f.vanguard.power) + 10000, `${cardId}/${side}`);
    assert.equal(f.state.pendingAttack.targetPower, Number(f.opponent.vanguard.power), `${cardId}/${side} does not affect opposing units`);
  }
});

test("non-front rows, wrong turn, low or unnamed Vanguard, wrong crest location, and foreign crest do not grant power", () => {
  const ability = Engine.parseCardAbilitiesCached(definition("cfa-10476")).find(item => item.id === "cfa-10476:2");
  const evaluate = (overrides = {}) => Engine.evaluateContinuousEffects([ability], {
    sourceLocation: "crest", sourceCardId: "cfa-10476", targetCircle: "rear-left", sourceInstanceId: "crest-source", targetInstanceId: "unit-target",
    isControllerTurn: true, controllerVanguardGrade: 3, controllerVanguardCardNames: ["Chronojet Dragon"],
    controllerGZoneCards: [{ uid: "g1", faceUp: true }, { uid: "g2", faceUp: true }, { uid: "down", faceUp: false }], ...overrides
  }).power;
  assert.equal(evaluate(), 10000);
  for (const overrides of [
    { targetCircle: "rear-back-left" }, { targetCircle: "guardian" }, { isControllerTurn: false },
    { controllerVanguardGrade: 2 }, { controllerVanguardCardNames: ["Different Vanguard"] },
    { sourceLocation: "rear-guard" }, { sourceCardId: "cfa-10668" }, { controllerGZoneCards: [{ uid: "down", faceUp: false }] },
    { targetCircle: "rear-back-center" }, { controllerVanguardCardNames: ["Chronojet Dragon"], sourceInstanceId: "", targetInstanceId: "" }
  ]) assert.equal(evaluate(overrides), 0, JSON.stringify(overrides));
  assert.equal(evaluate({ controllerGZoneCards: [{ uid: "g1", faceUp: true }, { uid: "g1", faceUp: true }] }), 5000, "duplicate G-zone instance IDs count once");
  for (const circle of ["vanguard", "rear-left", "rear-right", "rear-0", "rear-1", "accel-1"]) assert.equal(evaluate({ targetCircle: circle }), 10000, circle);
  const foreign = fixture("cfa-10476", "human", { foreignCrest: true });
  assert.equal(attack(foreign).ok, true);
  assert.equal(foreign.state.pendingAttack.power, Number(foreign.vanguard.power));
  const ambiguous = fixture("cfa-10476");
  ambiguous.own.rear[0] = { ...ambiguous.crest };
  assert.equal(attack(ambiguous).ok, true);
  assert.equal(ambiguous.state.pendingAttack.power, Number(ambiguous.vanguard.power), "a duplicated crest UID is not a legal effect source");
});

test("each crest name is checked independently against its corresponding Vanguard name", () => {
  const names = [...family.values()].map(value => value.name);
  for (const [cardId, item] of family) {
    const ability = Engine.parseCardAbilitiesCached(definition(cardId)).find(value => value.id === `${cardId}:2`);
    const context = { sourceLocation: "crest", sourceCardId: cardId, sourceInstanceId: `crest-${cardId}`, targetInstanceId: `target-${cardId}`,
      targetCircle: "rear-left", isControllerTurn: true, controllerVanguardGrade: 3,
      controllerGZoneCards: [{ uid: "g1", faceUp: true }], controllerVanguardCardNames: [item.name] };
    assert.equal(Engine.evaluateContinuousEffects([ability], context).power, 5000, cardId);
    for (const name of names.filter(candidate => candidate !== item.name)) {
      assert.equal(Engine.evaluateContinuousEffects([ability], { ...context, controllerVanguardCardNames: [name] }).power, 0, `${cardId} rejects ${name}`);
    }
  }
});

test("virtual crest tokens resolve only to their matching reviewed source card", () => {
  for (const [cardId, item] of family) {
    assert.equal(Engine.resolveCrestAbilityCardId({ isCrest: true, crestName: item.name, crestAbilityCardId: cardId }), cardId);
    const wrongId = [...family.keys()].find(otherId => otherId !== cardId);
    assert.equal(Engine.resolveCrestAbilityCardId({ isCrest: true, crestName: item.name, crestAbilityCardId: wrongId }), null);
  }
  assert.equal(Engine.resolveCrestAbilityCardId({ cardName: "Chronojet Dragon" }), null, "ordinary units do not inherit crest abilities by name");
});

test("a Stride heart name satisfies the named-Vanguard condition, but an unrelated heart does not", () => {
  const valid = fixture("cfa-10476", "human", { vanguardId: "cfa-2455", strideHeartId: "cfa-2480" });
  assert.equal(attack(valid).ok, true);
  assert.equal(valid.state.pendingAttack.power, Number(valid.vanguard.power) + 10000);
  const invalid = fixture("cfa-10476", "human", { vanguardId: "cfa-2455", strideHeartId: "cfa-3280" });
  assert.equal(attack(invalid).ok, true);
  assert.equal(invalid.state.pendingAttack.power, Number(invalid.vanguard.power));
});
