"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-vanguard-power-battle-v1";
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const singleSkill = family.filter(({ card }) => Engine.parseCardAbilitiesCached(card).length === 1);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function instance(cardId, uid, playerId) {
  const definition = cards.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name, ownerPlayerId: playerId,
    controllerPlayerId: playerId, grade: Number(definition?.grade), power: Number(definition?.power || 0),
    critical: 1, unitCard: true, rested: false, locked: false };
}

function fixture(card, ability, side) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const defenderSide = side === "human" ? "bot" : "human";
  const defenderId = side === "human" ? "player-guest" : "player-host";
  const source = instance(card.id, `source-${ability.id}-${side}`, ownerId);
  const target = instance("cfa-3", `target-${ability.id}-${side}`, defenderId);
  const sourceAtVanguard = ability.requiredLocation.includes("vanguard");
  const own = { playerId: ownerId, vanguard: sourceAtVanguard ? source : null, rear: Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [],
    triggerZone: [], gDeck: [], gZone: [], extra: [] };
  if (!sourceAtVanguard) own.rear[0] = source;
  const opponent = { playerId: defenderId, vanguard: target, rear: Array(5).fill(null), soul: [], hand: [],
    deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  const battleId = `battle-${ability.id}-${side}`;
  const attackPower = source.power;
  const state = { matchId: `own-vanguard-attack-${ability.id}-${side}`, stateVersion: 1, eventSequence: 0,
    turn: 3, side, phase: 5, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId,
      attackerZone: sourceAtVanguard ? "vanguard" : "rear-left", defenderSide, targetUid: target.uid,
      targetZone: "vanguard", power: attackPower, critical: 1 },
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const sourceLocation = sourceAtVanguard ? "vanguard" : "rear-left";
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId,
    turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [source.uid],
    previousLocation: sourceLocation, currentLocation: sourceLocation, targetCardInstanceIds: [target.uid],
    targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, event, source, target, own, opponent, side, ownerId, defenderId, attackPower };
}

function resolve(f, abilityId, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.source.uid}-${abilityId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId } } }, seats, Engine);
}

test("all 69 source-specific Vanguard attack AUTO definitions preserve exact printed circles, target, amount, and duration", () => {
  assert.equal(family.length, 69);
  assert.equal(new Set(family.map(({ ability }) => ability.id)).size, 69);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition => definition.id === ability.id), ability.id);
    assert.equal(ability.kind, "AUTO", ability.id);
    assert.ok(card.text.includes(ability.printedText), `${ability.id}: printed text is preserved`);
    assert.equal(ability.definition.source.patternId, PATTERN, ability.id);
    assert.equal(ability.trigger.eventType, "unit.attacked", ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.equal(ability.trigger.targetLocation, "vanguard", ability.id);
    assert.deepEqual(ability.requiredLocation, /\[RC\]/i.test(ability.printedText) ? ["rear-guard"] : ["vanguard"], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power\s*\+(\d+)/i)?.[1]), duration: "battle" }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("all six single-skill cards retain complete metadata for this ability", () => {
  assert.equal(singleSkill.length, 6);
  assert.equal(new Set(singleSkill.map(({ card }) => String(card.id))).size, 6);
  for (const { card, ability } of singleSkill) {
    assert.equal(Engine.parseCardAbilitiesCached(card).length, 1, `${ability.id}: no other printed abilities`);
    assert.equal(card.type, "Unit", ability.id);
    assert.ok(Number.isFinite(Number(card.grade)), `${ability.id}: grade`);
    assert.ok(Number.isFinite(Number(card.power)), `${ability.id}: power`);
    assert.ok(card.clan || card.clans?.length || String(card.text).split(/\r?\n/, 1)[0].includes("/"), `${ability.id}: clan`);
  }
});

test("every legal Vanguard-attack ability queues to and resolves for its source controller on both seats", () => {
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const f = fixture(card, ability, side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    const ownTrigger = discovered.queued.find(item => item.ability?.id === ability.id || item.abilityId === ability.id);
    assert.ok(ownTrigger, `${side} ${ability.id}: exact source attack qualifies; skipped=${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility?.side, side, `${side} ${ability.id}: trigger belongs to its controller`);
    assert.equal(f.state.pendingAbility?.instance.uid, f.source.uid, `${side} ${ability.id}: exact source card instance`);
    const accepted = resolve(f, ability.id);
    assert.equal(accepted.ok, true, `${side} ${ability.id}: ${accepted.reason}`);
    assert.equal(f.state.pendingAttack.power, f.attackPower + ability.definition.effects[0].amount, `${side} ${ability.id}: battle power`);
  }
});

test("another attack source, a Rear-Guard target, or a mismatched source circle cannot trigger these abilities", () => {
  for (const { card, ability } of family) {
    const base = fixture(card, ability, "human");
    const unrelatedSource = Engine.createGameEvent(base.state, { ...base.event, eventId: undefined, sequence: undefined,
      sourceCardInstanceId: "unrelated-instance", cardInstanceId: "unrelated-instance",
      subjectCardInstanceId: "unrelated-instance", attackingCardInstanceIds: ["unrelated-instance"] });
    assert.equal(Reducer.discoverAutoTriggers(base.state, [unrelatedSource], Engine).queued.some(item => item.ability?.id === ability.id || item.abilityId === ability.id), false, `${ability.id}: another instance attacked`);
    const rearTarget = Engine.createGameEvent(base.state, { ...base.event, eventId: undefined, sequence: undefined,
      targetLocation: "rear-guard", targetCardInstanceIds: ["opponent-rear"] });
    assert.equal(Reducer.discoverAutoTriggers(base.state, [rearTarget], Engine).queued.some(item => item.ability?.id === ability.id || item.abilityId === ability.id), false, `${ability.id}: did not attack a Vanguard`);
    const wrongCircle = Engine.createGameEvent(base.state, { ...base.event, eventId: undefined, sequence: undefined,
      previousLocation: "guardian", currentLocation: "guardian" });
    assert.equal(Reducer.discoverAutoTriggers(base.state, [wrongCircle], Engine).queued.some(item => item.ability?.id === ability.id || item.abilityId === ability.id), false, `${ability.id}: source did not attack from its required circle`);
  }
});

test("duplicate event processing cannot queue or apply this attack bonus twice", () => {
  for (const { card, ability } of singleSkill) for (const side of ["human", "bot"]) {
    const f = fixture(card, ability, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, ability.id);
    const first = resolve(f, ability.id);
    assert.equal(first.ok, true, first.reason);
    const powerAfterFirst = f.state.pendingAttack.power;
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${ability.id}/${side}: replayed event ignored`);
    assert.equal(f.state.pendingAttack.power, powerAfterFirst);
  }
});

test("the source controller cannot be replaced by forged event actor and controller identity", () => {
  const { card, ability } = family.find(item => item.ability.id === "cfa-37:1");
  const f = fixture(card, ability, "human");
  const forged = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, sequence: undefined,
    actingPlayerId: f.defenderId, turnPlayerId: f.defenderId,
    sourceControllerPlayerId: f.defenderId, subjectControllerPlayerId: f.defenderId });
  const result = Reducer.discoverAutoTriggers(f.state, [forged], Engine);
  assert.equal(result.queued.some(item => item.ability?.id === ability.id || item.abilityId === ability.id), false,
    "an opponent-authored attack event must not trigger the real host-controlled Vanguard's AUTO");
});
