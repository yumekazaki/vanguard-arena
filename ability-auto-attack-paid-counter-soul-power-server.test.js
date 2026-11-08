"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-paid-counter-soul-power-battle-v1";
const IDS = ["cfa-2419", "cfa-2423", "cfa-2432"];
const TEXT = "AUTO [VC/RC]: [Counter Blast 1 & Soul Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +5000 until end of that battle.";
const CARDS = loadCatalog();
globalThis.CARD_CATALOG = CARDS;
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => { const found = CARDS.find(item => String(item.id) === String(id)); assert.ok(found, `catalog card ${id}`); return found; };
function unit(cardId, uid, playerId, extra = {}) {
  const definition = card(cardId);
  return { uid, cardId: String(cardId), cardName: definition.name, grade: Number(definition.grade || 0), power: Number(definition.power || 10000), critical: 1,
    unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, position: "stand", ...extra };
}
function fixture({ cardId = IDS[0], side = "human", target = "vanguard", sourceCircle = "rear-left", attackSource = "source", faceUpDamage = 1, soulCount = 1 } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentId = side === "human" ? "guest-player" : "host-player";
  const opponentSide = side === "human" ? "bot" : "human", sourceOnVanguard = sourceCircle === "vanguard";
  const source = unit(cardId, `source-${side}-${cardId}-${sourceCircle}`, ownerId);
  const ownVanguard = sourceOnVanguard ? source : unit("cfa-2", `own-vg-${side}`, ownerId, { grade: 3, power: 13000 });
  const opponentVanguard = unit("cfa-2", `opp-vg-${side}`, opponentId, { grade: 3, power: 13000 });
  const ownRear = Array(5).fill(null), opponentRear = Array(5).fill(null);
  if (!sourceOnVanguard) ownRear[0] = source;
  let attacker = attackSource === "source" ? source : unit("cfa-2", `other-attacker-${side}`, ownerId, { grade: 2 });
  if (attackSource !== "source") ownRear[1] = attacker;
  let targetInstance = opponentVanguard, targetCardId = opponentVanguard.uid;
  if (target === "rear-guard") {
    targetInstance = unit("cfa-2", `opp-rear-${side}`, opponentId, { grade: 2, power: 9000 });
    opponentRear[0] = targetInstance;
    targetCardId = targetInstance.uid;
  }
  const damage = Array.from({ length: Math.max(1, faceUpDamage) }, (_, index) => unit("cfa-4", `damage-${side}-${index}`, ownerId, { zone: "damage", faceDown: index >= faceUpDamage }));
  const soul = Array.from({ length: soulCount }, (_, index) => unit("cfa-2", `soul-${side}-${index}`, ownerId, { zone: "soul" }));
  const hand = [], makePlayer = (playerId, vanguard, rear, cards = damage, soulCards = soul) => ({ playerId, vanguard, rear, damage: cards, soul: soulCards, hand, deck: [], drop: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], triggerZone: [] });
  const own = makePlayer(ownerId, ownVanguard, ownRear), opponent = makePlayer(opponentId, opponentVanguard, opponentRear, [], []);
  const state = { matchId: `any-target-paid-${cardId}-${side}-${target}`, stateVersion: 0, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [],
    turn: 3, side, phase: 5, firstTurnComplete: true, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    authoritySeats: { hostSide: "human", guestSide: "bot" }, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId: `attack-${state.matchId}`,
    expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: targetCardId } }, SEATS, Engine);
  const ability = Engine.parseCardAbilitiesCached(card(cardId)).find(item => item.id === `${cardId}:0`);
  return { state: result.state || state, result, side, ownerId, opponentId, own, opponent, source, attacker, ability, cardId, damage, soul, target };
}
function respond(f, { accept = true, actionId = `resolve-${f.cardId}-${f.side}`, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept,
    selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: f.own.damage.filter(item => !item.faceDown).slice(0, 1).map(item => item.uid), sb: f.own.soul.slice(0, 1).map(item => item.uid), discard: [], reveal: [] } } } }, SEATS, Engine);
}

test("three identical keyword-indexed abilities compile with exact VC/RC and unrestricted attack-target semantics", () => {
  for (const id of IDS) {
    const parsed = Engine.parseCardAbilitiesCached(card(id)).find(item => item.id === `${id}:0`);
    assert.ok(parsed?.definition, id);
    assert.equal(parsed.printedText, TEXT, id);
    assert.equal(parsed.definition.source.patternId, PATTERN, id);
    assert.equal(parsed.definition.source.officialTextVerified, id === "cfa-2432", id);
    assert.deepEqual(parsed.requiredLocation, ["vanguard", "rear-guard"], id);
    assert.equal(parsed.trigger.eventType, "unit.attacked", id);
    assert.equal(parsed.trigger.subject, "source", id);
    assert.equal(parsed.trigger.targetLocation, null, id);
    assert.deepEqual(parsed.costs, [{ type: "counter-blast", count: 1 }, { type: "soul-blast", count: 1 }], id);
    assert.deepEqual(parsed.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }], id);
    assert.equal(parsed.canDecline, true, id);
    assert.equal(Reducer.supportsServerAbilityEffects(parsed), true, id);
  }
});

test("both seats can resolve their own paid attack ability against a Vanguard or Rear-Guard", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) for (const target of ["vanguard", "rear-guard"]) for (const sourceCircle of ["vanguard", "rear-left"]) {
    const f = fixture({ cardId: id, side, target, sourceCircle });
    assert.equal(f.result.ok, true, `${id}/${side}/${target}/${sourceCircle}: ${f.result.reason}`);
    assert.equal(f.state.pendingAbility?.side, side, `${id}/${side}/${target}/${sourceCircle}`);
    assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
    const denied = respond(f, { actorAuthUid: side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid, actionId: `wrong-seat-${id}-${side}-${target}-${sourceCircle}` });
    assert.equal(denied.ok, false);
    const beforePower = f.state.pendingAttack.power, beforeDamage = f.own.damage.filter(item => !item.faceDown).length, beforeSoul = f.own.soul.length;
    const result = respond(f);
    assert.equal(result.ok, true, `${id}/${side}/${target}/${sourceCircle}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, beforePower + 5000);
    assert.equal(f.own.damage.filter(item => !item.faceDown).length, beforeDamage - 1);
    assert.equal(f.own.soul.length, beforeSoul - 1);
  }
});

test("unrelated attackers, unavailable costs, stale costs, and declines do not grant power or repeat", () => {
  const unrelated = fixture({ attackSource: "other" });
  assert.equal(unrelated.result.ok, true);
  assert.equal(unrelated.state.pendingAbility || null, null);
  assert.equal(fixture({ faceUpDamage: 0 }).state.pendingAbility || null, null);
  assert.equal(fixture({ soulCount: 0 }).state.pendingAbility || null, null);

  const stale = fixture();
  const beforePower = stale.state.pendingAttack.power, beforeDamage = stale.own.damage.filter(item => !item.faceDown).length;
  stale.own.soul.length = 0;
  const failed = respond(stale);
  assert.equal(failed.ok, false);
  assert.equal(stale.own.damage.filter(item => !item.faceDown).length, beforeDamage, "invalid Soul Blast must not partially pay Counter Blast");
  assert.equal(stale.state.pendingAttack.power, beforePower);

  const declined = fixture({ side: "bot" });
  const event = declined.state.pendingAbility?.eventContext?.gameEvent;
  assert.ok(event?.eventId);
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [event], Engine).queued.length, 0);
  assert.equal(respond(declined, { accept: false }).ok, true);
  assert.equal(declined.state.pendingAttack.power, beforePower);
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [event], Engine).queued.length, 0);

  const resolved = fixture({ side: "bot" });
  const resolvedEvent = resolved.state.pendingAbility?.eventContext?.gameEvent;
  const resolvedPower = resolved.state.pendingAttack.power;
  assert.equal(respond(resolved).ok, true);
  assert.equal(resolved.state.pendingAttack.power, resolvedPower + 5000);
  assert.equal(Reducer.discoverAutoTriggers(resolved.state, [resolvedEvent], Engine).queued.length, 0, "a resolved attack event cannot enqueue the ability again");
});
