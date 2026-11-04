"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-vanguard-attack-paid-power-battle-v1";
const FAMILY = {
  "cfa-2637": { index: 0, circle: "vanguard", condition: [], cb: 1, sb: 0, power: 10000 },
  "cfa-3079": { index: 0, circle: "vanguard", condition: [{ type: "damage-at-least", count: 3 }], cb: 1, sb: 0, power: 15000 },
  "cfa-4210": { index: 0, circle: "rear-guard", condition: [{ type: "damage-at-least", count: 3 }], cb: 1, sb: 0, power: 2000 },
  "cfa-4216": { index: 1, circle: "rear-guard", condition: [], gb: 1, cb: 1, sb: 1, power: 9000 },
  "cfa-4456": { index: 0, circle: "vanguard/rear-guard", condition: [{ type: "controller-hand-size-at-most", count: 3 }], cb: 1, sb: 0, power: 5000 },
  "cfa-4752": { index: 0, circle: "rear-guard", condition: [], gb: 1, cb: 1, sb: 0, power: 5000 }
};
const CARDS = loadCatalog();
globalThis.CARD_CATALOG = CARDS;
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardById = id => CARDS.find(card => String(card.id) === String(id));

function unit(cardId, uid, playerId, overrides = {}) {
  const card = cardById(cardId);
  return { uid, cardId, cardName: card?.name || cardId, grade: card?.grade ?? 2, power: card?.power ?? 9000, critical: 1,
    unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, position: "stand", ...overrides };
}
function fixture({ side = "human", cardId = "cfa-2637", attackSource = "source", sourceCircle, targetCircle = "vanguard", damageCount, faceUpDamage, soulCount, handCount, gbCount } = {}) {
  const spec = FAMILY[cardId], owner = side === "human" ? "host-player" : "guest-player", opponent = side === "human" ? "guest-player" : "host-player";
  const otherSide = side === "human" ? "bot" : "human", card = cardById(cardId);
  const circle = sourceCircle || spec.circle.split("/")[0], sourceZone = circle === "vanguard" ? "vanguard" : "rear-guard";
  const source = unit(cardId, "source-" + side + "-" + cardId, owner, { position: "stand" });
  const attacker = attackSource === "source" ? source : unit("cfa-2", "other-attacker-" + side + "-" + cardId, owner, { grade: 2, power: 9000 });
  const ownVanguard = sourceZone === "vanguard" ? source : unit("cfa-2", "own-vanguard-" + side, owner, { grade: 3, power: 13000 });
  const opposingVanguard = unit("cfa-2", "opposing-vanguard-" + side, opponent, { grade: 3, power: 13000 });
  const ownRear = Array(5).fill(null);
  if (sourceZone === "rear-guard") ownRear[0] = source;
  if (attackSource !== "source" && attacker !== ownVanguard) ownRear[sourceZone === "rear-guard" ? 1 : 0] = attacker;
  const opposingRear = Array(5).fill(null);
  let target = opposingVanguard, targetZone = "vanguard";
  if (targetCircle === "rear-guard") {
    target = unit("cfa-2", "opposing-rear-" + side, opponent, { grade: 2, power: 9000 });
    opposingRear[0] = target;
    targetZone = "rear-left";
  }
  const damage = Array.from({ length: damageCount ?? Math.max(1, spec.condition.some(c => c.type === "damage-at-least") ? 3 : 1) }, (_, index) =>
    ({ ...unit("cfa-4", "damage-" + side + "-" + cardId + "-" + index, owner), zone: "damage", faceDown: index >= (faceUpDamage ?? 1) }));
  const soul = Array.from({ length: soulCount ?? (spec.sb ? 1 : 0) }, (_, index) =>
    ({ ...unit("cfa-2", "soul-" + side + "-" + index, owner), zone: "soul" }));
  const hand = Array.from({ length: handCount ?? (cardId === "cfa-4456" ? 3 : 2) }, (_, index) =>
    ({ ...unit("cfa-2", "hand-" + side + "-" + index, owner), zone: "hand" }));
  const gZone = Array.from({ length: gbCount ?? (spec.gb || 0) }, (_, index) =>
    ({ ...unit("cfa-2", "gb-" + side + "-" + index, owner), zone: "g-zone", faceUp: true, gDeckCard: true }));
  const makePlayer = (playerId, vanguard, rear, damageCards = [], soulCards = [], handCards = [], gCards = []) => ({
    playerId, vanguard, rear, damage: damageCards, soul: soulCards, hand: handCards, gZone: gCards,
    deck: [], drop: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], triggerZone: []
  });
  const own = makePlayer(owner, ownVanguard, ownRear, damage, soul, hand, gZone);
  const other = makePlayer(opponent, opposingVanguard, opposingRear);
  const state = {
    matchId: "paid-attack-" + side + "-" + cardId + "-" + attackSource + "-" + targetCircle, stateVersion: 0, processedActionIds: [], processedEventIds: [],
    processedAbilityTriggers: [], turn: 3, side, phase: 5, firstTurnComplete: true, pendingAttack: null,
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" },
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own }
  };
  const result = Reducer.applyGameAction(state, {
    actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId: "attack-" + state.matchId,
    expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: target.uid }
  }, SEATS, Engine);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === cardId + ":" + spec.index);
  return { state: result.state || state, result, side, owner, opponent, own, source, attacker, target, ability, cardId, spec, damage, soul };
}
function resolve(f, actionId = "resolve-" + f.cardId + "-" + f.side) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
      selection: { instanceUid: pending?.instance?.uid, abilityId: pending?.ability?.id,
        costSelections: {
        cb: (f.own.damage || []).filter(card => !card.faceDown).slice(0, f.spec.cb).map(card => card.uid),
        sb: (f.own.soul || []).slice(0, f.spec.sb).map(card => card.uid), discard: [], reveal: []
      } } } }, SEATS, Engine);
}
function countFaceUpDamage(player) { return player.damage.filter(card => !card.faceDown).length; }

test("the shared text parser derives all six real cost-paid Vanguard attack abilities", () => {
  for (const [cardId, spec] of Object.entries(FAMILY)) {
    const card = cardById(cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === cardId + ":" + spec.index);
    assert.ok(ability, cardId + ":" + spec.index);
    assert.ok(card.text.includes(ability.printedText), cardId + " preserves exact catalog text");
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.conditions, spec.condition);
    assert.equal(ability.gb, spec.gb || 0);
    assert.deepEqual(ability.requiredLocation, spec.circle === "vanguard" ? ["vanguard"] : spec.circle === "rear-guard" ? ["rear-guard"] : ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: spec.cb }, ...(spec.sb ? [{ type: "soul-blast", count: spec.sb }] : [])]);
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: spec.power, duration: "battle" }]);
    assert.equal(ability.canDecline, true);
    assert.equal(ability.costStatus, "supported-cost");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player resolve only their own exact eligible Vanguard attack ability", () => {
  for (const side of ["human", "bot"]) for (const [cardId, spec] of Object.entries(FAMILY)) {
    const circles = cardId === "cfa-4456" ? ["vanguard", "rear-guard"] : [spec.circle.split("/")[0]];
    for (const sourceCircle of circles) {
      const f = fixture({ side, cardId, sourceCircle });
      assert.equal(f.result.ok, true, side + "/" + cardId + "/" + sourceCircle + ": " + f.result.reason);
      assert.equal(f.state.pendingAbility?.side, side, side + "/" + cardId + "/" + sourceCircle + " " + JSON.stringify({ result: f.result, pending: f.state.pendingAbility, queued: f.state.pendingAbilities }));
      assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
      assert.equal(f.state.pendingAbility?.ability?.definition?.source?.patternId, PATTERN);
      const denied = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid,
        actionId: "wrong-seat-" + side + "-" + cardId + "-" + sourceCircle, expectedStateVersion: f.state.stateVersion,
        payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, SEATS, Engine);
      assert.equal(denied.ok, false);
      const beforeFaceUp = countFaceUpDamage(f.own), beforeSoul = f.own.soul.length, beforePower = f.state.pendingAttack.power;
      const resolved = resolve(f);
      assert.equal(resolved.ok, true, side + "/" + cardId + "/" + sourceCircle + " " + JSON.stringify({ reason: resolved.reason, ability: f.state.pendingAbility }));
      assert.equal(f.state.pendingAttack.power, beforePower + spec.power);
      assert.equal(countFaceUpDamage(f.own), beforeFaceUp - spec.cb);
      assert.equal(f.own.soul.length, beforeSoul - spec.sb);
    }
  }
});

test("another source, wrong attack target, and unmet Shinken Hissatsu, GB1, or Brave conditions do not queue", () => {
  for (const [cardId, spec] of Object.entries(FAMILY)) {
    const unrelated = fixture({ cardId, attackSource: "other" });
    assert.equal(unrelated.result.ok, true, cardId + ": " + unrelated.result.reason);
    assert.equal(unrelated.state.pendingAbility, null, cardId + " must match the source instance");
    const wrongTarget = fixture({ cardId, targetCircle: "rear-guard" });
    assert.equal(wrongTarget.result.ok, true, cardId + ": " + wrongTarget.result.reason);
    assert.equal(wrongTarget.state.pendingAbility, null, cardId + " requires attack on a Vanguard");
    if (cardId === "cfa-3079" || cardId === "cfa-4210") {
      const condition = fixture({ cardId, damageCount: 2 });
      assert.equal(condition.state.pendingAbility, null, cardId + " Shinken Hissatsu requires 3 Damage");
    }
    if (cardId === "cfa-4216" || cardId === "cfa-4752") {
      const condition = fixture({ cardId, gbCount: 0 });
      assert.equal(condition.state.pendingAbility, null, cardId + " requires GB1");
    }
    if (cardId === "cfa-4456") {
      const condition = fixture({ cardId, handCount: 4 });
      assert.equal(condition.state.pendingAbility, null, "Brave requires three or fewer cards in hand");
    }
    if (spec.circle === "vanguard") {
      const wrongCircle = fixture({ cardId, sourceCircle: "rear-guard" });
      assert.equal(wrongCircle.state.pendingAbility, null, cardId + " cannot activate from RC");
    }
    if (spec.circle === "rear-guard") {
      const wrongCircle = fixture({ cardId, sourceCircle: "vanguard" });
      assert.equal(wrongCircle.state.pendingAbility, null, cardId + " cannot activate from VC");
    }
  }
});

test("unpayable costs suppress prompts and revalidation rejects atomically if a condition or resource changes", () => {
  for (const cardId of Object.keys(FAMILY)) {
    const spec = FAMILY[cardId];
    const noCounterBlast = fixture({ cardId, faceUpDamage: 0, damageCount: Math.max(1, spec.condition.some(c => c.type === "damage-at-least") ? 3 : 1) });
    assert.equal(noCounterBlast.state.pendingAbility, null, cardId + " should not offer an unpayable Counter Blast");
    if (spec.sb) {
      const noSoul = fixture({ cardId, soulCount: 0 });
      assert.equal(noSoul.state.pendingAbility, null, cardId + " should not offer an unpayable Soul Blast");
    }
  }
  const shinken = fixture({ cardId: "cfa-3079" });
  const shinkenFaceUp = countFaceUpDamage(shinken.own), shinkenPower = shinken.state.pendingAttack.power;
  shinken.own.damage.pop();
  const changedCondition = resolve(shinken);
  assert.equal(changedCondition.ok, false);
  assert.equal(countFaceUpDamage(shinken.own), shinkenFaceUp, "condition rejection must not pay CB");
  assert.equal(shinken.state.pendingAttack.power, shinkenPower, "condition rejection must not partially apply power");

  const paid = fixture({ cardId: "cfa-4216" });
  const faceUp = countFaceUpDamage(paid.own), power = paid.state.pendingAttack.power;
  paid.own.soul.length = 0;
  const changedCost = resolve(paid);
  assert.equal(changedCost.ok, false);
  assert.equal(countFaceUpDamage(paid.own), faceUp, "cost rejection must not pay Counter Blast partially");
  assert.equal(paid.state.pendingAttack.power, power, "cost rejection must not apply the effect");
});

test("duplicate event delivery and repeated action IDs cannot pay or apply a cost twice", () => {
  const f = fixture({ side: "bot", cardId: "cfa-4216" });
  const event = f.state.pendingAbility?.eventContext?.gameEvent;
  assert.ok(event?.eventId);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0);
  const beforeFaceUp = countFaceUpDamage(f.own), beforeSoul = f.own.soul.length;
  assert.equal(resolve(f, "single-paid-attack-action").ok, true);
  const afterPower = f.state.pendingAttack.power;
  const replay = Reducer.applyAbilityDecision(f.state, { actorAuthUid: SEATS.guestAuthUid, actionId: "single-paid-attack-action",
    expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, SEATS, Engine);
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "duplicate-action");
  assert.equal(countFaceUpDamage(f.own), beforeFaceUp - 1);
  assert.equal(f.own.soul.length, beforeSoul - 1);
  assert.equal(f.state.pendingAttack.power, afterPower);
});
