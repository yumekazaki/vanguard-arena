"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-rear-guard-count-power-battle-v1";
const catalog = loadCatalog();
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(card, ability, { side = "human", ownRearGuards = 3, opponentRearGuards = 0, sourceCircle = null, targetLocation = "vanguard", attackerUid = null } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const defenderSide = side === "human" ? "bot" : "human";
  const defenderId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${ability.id}-${side}`, cardId: String(card.id), cardName: card.name,
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, grade: Number(card.grade),
    power: Number(card.power || 10000), critical: 1, unitCard: true, rested: false, locked: false };
  const target = { uid: `target-${ability.id}-${side}`, cardId: "cfa-3", ownerPlayerId: defenderId,
    controllerPlayerId: defenderId, grade: 3, power: 13000, critical: 1, unitCard: true };
  const sourceAtVanguard = sourceCircle ? sourceCircle === "vanguard" : ability.requiredLocation.includes("vanguard");
  const own = { playerId: ownerId, vanguard: sourceAtVanguard ? source : null, rear: Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  const opponent = { playerId: defenderId, vanguard: target, rear: Array(5).fill(null), soul: [], hand: [], deck: [],
    drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  let ownIndex = 0;
  if (!sourceAtVanguard) own.rear[ownIndex++] = source;
  while (ownIndex < Math.min(ownRearGuards, own.rear.length)) {
    own.rear[ownIndex] = { uid: `own-rg-${ability.id}-${side}-${ownIndex}`, cardId: "cfa-2",
      ownerPlayerId: ownerId, controllerPlayerId: ownerId, grade: 1, unitCard: true };
    ownIndex++;
  }
  for (let index = 0; index < Math.min(opponentRearGuards, opponent.rear.length); index++) {
    opponent.rear[index] = { uid: `opp-rg-${ability.id}-${side}-${index}`, cardId: "cfa-2",
      ownerPlayerId: defenderId, controllerPlayerId: defenderId, grade: 1, unitCard: true };
  }
  const sourceZone = sourceAtVanguard ? "vanguard" : "rear-left";
  const attackedUid = attackerUid || source.uid;
  const battleId = `battle-${ability.id}-${side}`;
  const state = { matchId: `rear-guard-count-${ability.id}-${side}`, stateVersion: 1, eventSequence: 0,
    turn: 4, side, phase: 5, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId,
      attackerZone: sourceZone, defenderSide, targetUid: target.uid, targetZone: targetLocation,
      power: source.power, critical: 1 },
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attackedUid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: attackedUid, subjectCardInstanceId: attackedUid, subjectOwnerPlayerId: ownerId,
    subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [attackedUid], previousLocation: sourceZone,
    currentLocation: sourceZone, targetCardInstanceIds: [target.uid], targetLocation, battleId,
    phase: "battle", timingWindow: "attack-declared" });
  return { state, event, source, own, opponent, side, ownerId, defenderId, battleId, ability };
}

function resolve(f) {
  const actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.source.uid}-${f.ability.id}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

function queuedAbility(state, abilityId) {
  return [...(state.pendingAbilities || []), ...(state.pendingAbility ? [state.pendingAbility] : [])]
    .find(pending => pending?.ability?.id === abilityId || pending?.abilityId === abilityId);
}

test("the exact four audited abilities preserve their printed circle, condition, battle duration, and amount", () => {
  assert.equal(family.length, 4);
  assert.deepEqual(new Set(family.map(({ ability }) => ability.id)), new Set(["cfa-5711:0", "cfa-5763:1", "cfa-9939:0", "cfa-9945:0"]));
  for (const { card, ability } of family) {
    assert.ok(card.text.includes(ability.printedText), `${ability.id}: exact printed text`);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition => definition.id === ability.id), `${ability.id}: registered trusted definition`);
    assert.equal(ability.conditionStatus, "modeled", `${ability.id}: modeled condition`);
    assert.deepEqual(ability.conditions, [{ type: "controller-rear-guards-at-least", count: 3 }], ability.id);
    assert.deepEqual(ability.requiredLocation, ability.printedText.includes("[RC]") && !ability.printedText.includes("[VC/RC]") ? ["rear-guard"] : ["vanguard", "rear-guard"], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "battle" }], ability.id);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("both players resolve the bonus for their own exact attacker only when they have at least three Rear-Guards", () => {
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const legal = fixture(card, ability, { side, ownRearGuards: 3, opponentRearGuards: 5 });
    const discovery = Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine);
    const pending = queuedAbility(legal.state, ability.id);
    assert.ok(pending, `${side}/${ability.id}: source attack and own rear-guard count qualify; ${JSON.stringify(discovery.skipped)}`);
    assert.equal(pending.side, side, `${side}/${ability.id}: decision belongs to the controller`);
    assert.equal(pending.instance.uid, legal.source.uid, `${side}/${ability.id}: exact source instance`);
    const resolved = resolve(legal);
    assert.equal(resolved.ok, true, `${side}/${ability.id}: ${resolved.reason}`);
    assert.equal(legal.state.pendingAttack.power, Number(card.power || 10000) + ability.definition.effects[0].amount, `${side}/${ability.id}: battle power only`);
  }
});

test("other units attacking, attacking a Rear-Guard, too few friendly Rear-Guards, and a wrong source circle do not trigger", () => {
  for (const { card, ability } of family) {
    const noAttack = fixture(card, ability, { ownRearGuards: 3, attackerUid: "different-card-instance" });
    Reducer.discoverAutoTriggers(noAttack.state, [noAttack.event], Engine);
    assert.equal(queuedAbility(noAttack.state, ability.id), undefined, `${ability.id}: another unit attacked`);

    const wrongTarget = fixture(card, ability, { ownRearGuards: 3, targetLocation: "rear-guard" });
    Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine);
    assert.equal(queuedAbility(wrongTarget.state, ability.id), undefined, `${ability.id}: source did not attack a vanguard`);

    const tooFew = fixture(card, ability, { ownRearGuards: 2, opponentRearGuards: 5 });
    Reducer.discoverAutoTriggers(tooFew.state, [tooFew.event], Engine);
    assert.equal(queuedAbility(tooFew.state, ability.id), undefined, `${ability.id}: opponent's Rear-Guards cannot satisfy the condition`);
  }

  const { card, ability } = family.find(item => item.ability.id === "cfa-5711:0");
  const wrongCircle = fixture(card, ability, { ownRearGuards: 3, sourceCircle: "vanguard" });
  Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine);
  assert.equal(queuedAbility(wrongCircle.state, ability.id), undefined, `${ability.id}: RC-only source cannot trigger from VC`);
});

test("the same attack event cannot queue or resolve this source's bonus twice", () => {
  const { card, ability } = family.find(item => item.ability.id === "cfa-9939:0");
  const f = fixture(card, ability, { ownRearGuards: 3 });
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.ok(queuedAbility(f.state, ability.id));
  assert.equal(resolve(f).ok, true);
  const powerAfterResolution = f.state.pendingAttack.power;
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.state.pendingAttack.power, powerAfterResolution);
});
