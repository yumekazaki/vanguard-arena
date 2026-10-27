"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-12806", "cfa-12807", "cfa-12808", "cfa-12817", "cfa-12818", "cfa-13028"];
const PATTERN = "auto-turn-discard-grade-two-soul-blast-call-rested-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Test Unit", type: "Unit", unitCard: true, grade: 1, power: 8000, critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(side = "human", { grade = 2, phase = 5, soul = 1 } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const source = card(IDS[0], `discarded-${side}`, ownerId, { zone: "drop" });
  const vanguard = card("cfa-2", `vanguard-${side}`, ownerId, { grade, power: 13000, zone: "vanguard" });
  const soulCards = Array.from({ length: soul }, (_, index) => card("cfa-2", `soul-${side}-${index}`, ownerId, { zone: "soul" }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : card("cfa-2", "vanguard-human", "player-host", { grade: 3, zone: "vanguard" }), rear: side === "human" ? [null, null, null, null, null] : [null, null, null, null, null], soul: side === "human" ? soulCards : [], drop: side === "human" ? [source] : [], hand: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : card("cfa-2", "vanguard-bot", "player-guest", { grade: 3, zone: "vanguard" }), rear: side === "bot" ? [null, null, null, null, null] : [null, null, null, null, null], soul: side === "bot" ? soulCards : [], drop: side === "bot" ? [source] : [], hand: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] }
  };
  const state = { matchId: "discard-grade-call", stateVersion: 1, turn: 5, side, phase, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const ability = Engine.parseCardAbilitiesCached(catalog.find(item => String(item.id) === IDS[0])).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, "exact discard-call skill compiles");
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: ownerId, turnPlayerId: ownerId, phase: phase === 5 ? "battle" : "main",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "drop", reason: "effect"
  });
  return { side, otherSide, ownerId, state, source, vanguard, ability, event };
}

function resolve(f, extra = {}, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, callZone: "rear-left", costSelections: { sb: [`soul-${f.side}-0`] }, ...extra } }
  }, seats, Engine);
}

test("all six exact discarded-card abilities are structured and pass the trusted handler gate", () => {
  for (const id of IDS) {
    const definition = catalog.find(item => String(item.id) === id);
    const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.definition?.source?.patternId === PATTERN);
    assert.ok(ability, `${id} compiled`);
    assert.equal(ability.id, `${id}:0`);
    assert.equal(ability.trigger.eventType, "card.discarded");
    assert.equal(ability.trigger.subject, "event-subject");
    assert.deepEqual(ability.requiredLocation, ["hand"]);
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("the exact source's discard prompts its controller and calls rested after Soul Blast for either online seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    assert.equal(Engine.eventMatchesAbilityTrigger(f.ability, "discard", f.event, f.source.uid, "hand", "drop", f.ownerId), true, JSON.stringify({ability:f.ability.trigger,event:f.event,source:f.source}));
    const loc=Engine.locateCardInstance(f.state,f.source.uid),cc=Reducer.buildConditionContext(f.state,f.event,loc,Engine);
    assert.equal(Engine.evaluateAbilityConditions(f.ability,cc),true,JSON.stringify({cc,conditions:f.ability.conditions}));
    const discovered=Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, JSON.stringify(discovered));
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    const called = f.state.players[side].rear[0];
    assert.equal(called.uid, f.source.uid);
    assert.equal(called.rested, true);
    assert.equal(f.state.players[side].soul.length, 0);
    assert.equal(f.state.players[f.otherSide].rear.filter(Boolean).length, 0);
  }
});

test("grade, turn, exact instance, and cost conditions prevent false prompts", () => {
  for (const options of [{ grade: 1 }, { soul: 0 }]) {
    const f = fixture("bot", options);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, JSON.stringify(options));
  }
  const f = fixture("bot");
  const unrelated = Engine.createGameEvent(f.state, { ...f.event, eventId: "unrelated-discard", sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [unrelated], Engine).queued.length, 0);
});

test("only the joining player can resolve their own discard AUTO; declined abilities do not pay", () => {
  const f = fixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const forged = resolve(f, {}, seats.hostAuthUid);
  assert.equal(forged.ok, false);
  assert.equal(f.state.players.bot.soul.length, 1);
  const declined = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.guestAuthUid, actionId: "decline-discard-call", expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
  assert.equal(declined.ok, true, declined.reason);
  assert.equal(f.state.players.bot.soul.length, 1);
  assert.equal(f.state.players.bot.rear.filter(Boolean).length, 0);
});

test("a battle-phase call cannot attack later that turn even if stood", () => {
  const f = fixture("human");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = resolve(f);
  assert.equal(result.ok, true, result.reason);
  const called = f.state.players.human.rear[0];
  assert.equal(called.cannotAttackTurnKey, `${f.state.turn}:human`);
  called.rested = false;
  const target = f.state.players.bot.vanguard;
  const attack = Reducer.applyGameAction(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "restricted-call-attack", expectedStateVersion: f.state.stateVersion,
    payload: { action: "attack", attackerCardInstanceId: called.uid, targetCardInstanceId: target.uid }
  }, seats, Engine);
  assert.equal(attack.ok, false);
  assert.equal(attack.reason, "attacker-cannot-attack");
});
