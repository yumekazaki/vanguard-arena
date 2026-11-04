"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-front-row-opponent-intercept-ability-negation-v1";
const IDS = ["cfa-13119:0", "cfa-13120:0", "cfa-13121:0", "cfa-13122:0", "cfa-13123:0", "cfa-13124:0"];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => { const value = cards.get(String(id)); assert.ok(value, `card ${id} exists`); return value; };
const instance = (id, uid, playerId, extra = {}) => {
  const value = card(id);
  return { uid, cardId: String(id), cardName: value.name, type: value.type || "Unit", grade: Number(value.grade), power: Number(value.power || 0), shield: Number(value.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
};

function fixture({ suppressorSide = "human", sourceRow = "front", sourceFaceUp = true, sourceCardId = "cfa-13119", interceptorCardId = "cfa-10101" } = {}) {
  const defenderSide = suppressorSide === "human" ? "bot" : "human";
  const sourcePlayerId = suppressorSide === "human" ? "host" : "guest";
  const defenderPlayerId = defenderSide === "human" ? "host" : "guest";
  const sourceIndex = sourceRow === "front" ? 0 : 2;
  const sourceCircle = sourceRow === "front" ? "rear-left" : "rear-back-left";
  const source = instance(sourceCardId, `suppressor-${suppressorSide}`, sourcePlayerId, { circle: sourceCircle, faceUp: sourceFaceUp });
  const attackerVanguard = instance("cfa-13", `attacker-vg-${suppressorSide}`, sourcePlayerId, { grade: 3 });
  const defenderVanguard = instance("cfa-13", `defender-vg-${defenderSide}`, defenderPlayerId, { grade: 3 });
  const interceptor = instance(interceptorCardId, `interceptor-${defenderSide}`, defenderPlayerId, { circle: "rear-left" });
  const makePlayer = (playerId, vanguard) => ({ playerId, vanguard, rear: Array(6).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const attacker = makePlayer(sourcePlayerId, attackerVanguard), defender = makePlayer(defenderPlayerId, defenderVanguard);
  attacker.rear[sourceIndex] = source;
  attacker.gZone = [{ uid: `g-zone-${suppressorSide}`, cardId: "g-zone-fixture", faceUp: false }];
  defender.rear[0] = interceptor;
  defender.rear[2] = instance("cfa-13", `back-row-a-${defenderSide}`, defenderPlayerId, { circle: "rear-back-left" });
  defender.rear[3] = instance("cfa-13", `back-row-b-${defenderSide}`, defenderPlayerId, { circle: "rear-back-center" });
  const players = suppressorSide === "human" ? { human: attacker, bot: defender } : { human: defender, bot: attacker };
  const attack = { battleId: `ability-negation-${suppressorSide}-${interceptorCardId}`, attackerSide: suppressorSide, attackerPlayerId: sourcePlayerId, attackerUid: attackerVanguard.uid, attackerZone: "vanguard", defenderSide, defenderPlayerId, targetUid: defenderVanguard.uid, targetZone: "vanguard", guardCards: [], power: 18000, targetPower: 10000, critical: 1, defenderDone: false };
  const state = { matchId: "intercept-ability-negation", stateVersion: 3, turn: 2, side: suppressorSide, phase: 5, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players, pendingAttack: attack };
  return { state, source, interceptor, sourcePlayerId, defenderPlayerId, defenderSide, sourceIndex, attack };
}

function intercept(f, actionId = `intercept-${f.source.uid}`) {
  const result=Reducer.applyGameAction(f.state, {
    actorAuthUid: f.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "intercept", cardInstanceId: f.interceptor.uid }
  }, seats, Engine);
  if(result.ok)result.triggerDiscovery=Reducer.discoverAutoTriggers(f.state,result.events||[],Engine);
  return result;
}

test("all six exact catalog abilities are compiled and registered with the shared CONT handler", () => {
  const found = [];
  for (const value of catalog) for (const ability of Engine.parseCardAbilitiesCached(value)) {
    if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  }
  assert.deepEqual(found.map(value => value.id).sort(), IDS.slice().sort());
  for (const ability of found) {
    const registered = Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).find(value => value.id === ability.id);
    assert.ok(registered, `${ability.id} is trusted by the server`);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.definition.continuousEffects[0], {
      type: "suppress-abilities", target: "opponent-intercepted-guardian-unit", abilityKinds: ["AUTO", "CONT"], duration: "continuous",
      sourceCircle: "front-row", targetZone: "guardian", targetEntryLocation: "rear-guard", condition: { op: "controller-turn" }
    });
    assert.equal(ability.trigger, null, "CONT is passive and must not produce an activation prompt");
  }
});

test("official wording variants and the exact legacy catalog wording compile without fuzzy matching", () => {
  const variants = [
    "[CONT]Front Row (RC):During your turn, your opponent's intercept does not activate [AUTO] abilities, and all of your opponent's units put on (GC) from (RC) lose all of their [CONT] and [AUTO] abilities.",
    "[CONT](Front Row RC):During your turn, the [AUTO] abilities cannot activate by your opponent's intercepts, and all of your opponent's units put on (GC) from (RC) lose all of their [CONT] abilities and [AUTO] abilities."
  ];
  for (const [index, text] of variants.entries()) {
    const parsed = Engine.parseCardAbilities({ id: `reviewed-wording-${index}`, text });
    assert.equal(parsed[0]?.definition?.source?.patternId, PATTERN);
  }
  const altered = Engine.parseCardAbilities({ id: "altered-wording", text: "[CONT]Front Row (RC):During your turn, your opponent's intercept does not activate [AUTO] abilities, and all units put on (GC) lose all abilities." });
  assert.equal(altered[0]?.definition, null, "semantically similar but unreviewed wording stays unsupported");
});

test("both online seats suppress an opponent's intercept AUTO and GC CONT abilities on the source controller's turn", () => {
  for (const suppressorSide of ["human", "bot"]) {
    for (const sourceCardId of IDS.map(id => id.split(":")[0])) {
      const auto = fixture({ suppressorSide, sourceCardId, interceptorCardId: "cfa-10101" });
      const autoResult = intercept(auto);
      assert.equal(autoResult.ok, true, `${sourceCardId} ${suppressorSide}: ${autoResult.reason}`);
      assert.equal(auto.interceptor.guardianEntryOrigin, "rear-guard", `${sourceCardId} ${suppressorSide}`);
      assert.equal([auto.state.pendingAbility, ...auto.state.pendingAbilities].filter(value => value?.ability?.id === "cfa-10101:0").length, 0, `${sourceCardId} ${suppressorSide}: intercept AUTO does not activate or prompt the defender`);

      const cont = fixture({ suppressorSide, sourceCardId, interceptorCardId: "cfa-13230" });
      const contResult = intercept(cont);
      assert.equal(contResult.ok, true, `${sourceCardId} ${suppressorSide}: ${contResult.reason}`);
      assert.equal(cont.attack.targetPower, 15000, `${sourceCardId} ${suppressorSide}: the intercepted unit adds only printed shield; its GC CONT shield is suppressed`);
    }
  }
});

test("suppression requires the exact active front-row source and rear-guard-to-GC provenance", () => {
  for (const options of [{ sourceRow: "back" }, { sourceFaceUp: false }]) {
    const f = fixture({ ...options, interceptorCardId: "cfa-13230" });
    const result = intercept(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.attack.targetPower, 20000, "without an active front-row source, the intercepting unit keeps its GC CONT shield");
  }
  const registered = Engine.getReviewedAbilityDefinitionsForCard("cfa-13119");
  const ability = Engine.parseCardAbilities({ id: "cfa-13119", text: card("cfa-13119").text })[0];
  const context = { sourceLocation: "rear-guard", sourceIsFrontRow: true, sourceFaceUp: true, sourceControllerPlayerId: "host", turnPlayerId: "host", targetLocation: "guardian", targetEntryLocation: "hand", targetControllerPlayerId: "guest", abilityKind: "CONT" };
  assert.equal(Engine.evaluateContinuousAbilitySuppression([ability], context).suppressed, false, "a unit guarded from hand is not silenced");
  assert.equal(Engine.evaluateContinuousAbilitySuppression([ability], { ...context, targetEntryLocation: "rear-guard", targetControllerPlayerId: "host" }).suppressed, false, "same-controller units are not silenced");
  assert.ok(registered.some(value => value.id === "cfa-13119:0"));
});
