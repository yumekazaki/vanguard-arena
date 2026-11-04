"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const FAMILY = [
  { cardId: "cfa-493", abilityId: "cfa-493:0", amount: 3000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=TD02%2F016EN" },
  { cardId: "cfa-506", abilityId: "cfa-506:0", amount: 5000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT05%2F040EN" },
  { cardId: "cfa-507", abilityId: "cfa-507:0", amount: 3000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=TD02%2F010EN" }
];
const PATTERN = "auto-opponent-rearguard-drop-main-phase-power-turn-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => CATALOG.find(card => String(card.id) === String(id));
const make = (cardId, uid, playerId, extra = {}) => {
  const card = cardFor(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade), power: Number(card.power || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
};
const authFor = side => side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;

function fixture({ side = "human", entry = FAMILY[0], sourceZone = "rear-left", phase = 4 } = {}) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = side === "human" ? "player-guest" : "player-host";
  const source = make(entry.cardId, `source-${side}-${entry.cardId}`, ownId, { zone: sourceZone === "vanguard" ? "vanguard" : "rear-guard", circle: sourceZone });
  const ownVanguard = make("cfa-14047", `vg-${side}`, ownId, { zone: "vanguard", circle: "vanguard" });
  const otherVanguard = make("cfa-14047", `vg-${otherSide}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const victim = make("cfa-14047", `victim-${side}`, otherId, { zone: "rear-guard", circle: "rear-left" });
  const player = (playerId, vanguard) => ({ playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] });
  const own = player(ownId, sourceZone === "vanguard" ? source : ownVanguard);
  const opponent = player(otherId, otherVanguard);
  if (sourceZone === "vanguard") own.rear[0] = null;
  else own.rear[0] = source;
  opponent.rear[0] = victim;
  const state = {
    matchId: `opponent-retire-${side}-${entry.cardId}`, stateVersion: 1, turn: 1, phase, side,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent }
  };
  const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parsed`);
  return { state, source, victim, ability, side, ownId, otherId, otherSide, entry };
}

function retireEvent(f, overrides = {}) {
  const opponent = f.state.players[f.otherSide];
  const [victim] = opponent.rear.splice(0, 1, null);
  opponent.drop.push(victim);
  return Engine.createGameEvent(f.state, {
    type: "card.retired", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: victim.uid, subjectCardInstanceId: victim.uid, subjectOwnerPlayerId: victim.ownerPlayerId,
    subjectControllerPlayerId: victim.controllerPlayerId, previousLocation: "rear-left", currentLocation: "drop",
    phase: "main", timingWindow: "ability-resolution", ...overrides
  });
}

function discover(f, event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, actionId = `resolve-${f.side}-${f.entry.cardId}`) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authFor(f.side), actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: pending?.ability?.id || f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, SEATS, Engine);
}

test("officially sourced cards compile the exact mandatory Main Phase RC retirement ability", () => {
  for (const entry of FAMILY) {
    const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
    assert.ok(ability);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, {
      status: "recognized-trigger", eventType: "card.retired", subject: "different-card", circles: [],
      sourceLocation: "rear-guard", destinationLocation: "drop", subjectControllerRelation: "opponent",
      requiredPhase: "main", turnRelation: "controller"
    });
    assert.deepEqual(ability.conditions, []);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: entry.amount, duration: "turn" }]);
    assert.ok(ability.definition.source.officialReferences.includes(entry.reference));
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player each receive and resolve power for an opponent Rear-Guard retired on their Main Phase", () => {
  for (const side of ["human", "bot"]) for (const entry of FAMILY) {
    const f = fixture({ side, entry });
    const event = retireEvent(f);
    const found = discover(f, event);
    assert.equal(found.queued.length, 1, `${side}/${entry.cardId}: ${JSON.stringify(found.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}/${entry.cardId}: ${result.reason}`);
    assert.equal(f.source.turnPowerBoost, entry.amount);
    assert.equal(f.source.turnPowerExpiry, f.ownId);
    assert.equal(f.source.power, Number(cardFor(entry.cardId).power));
  }
});

test("friendly cards, non-Rear-Guard moves, wrong destination, wrong phase, and an identity-less subject do not trigger", () => {
  const wrong = [
    { label: "friendly card", override: { subjectOwnerPlayerId: "player-host", subjectControllerPlayerId: "player-host" } },
    { label: "other source zone", override: { previousLocation: "hand" } },
    { label: "other destination", override: { currentLocation: "bind" } },
    { label: "opponent turn", override: { turnPlayerId: "player-guest" } },
    { label: "battle phase", override: { phase: "battle" } },
    { label: "event subject identity missing", override: { subjectCardInstanceId: null } },
    { label: "event card does not match subject", override: { cardInstanceId: "different-victim" } }
  ];
  for (const entry of FAMILY) for (const scenario of wrong) {
    const f = fixture({ entry });
    let event = retireEvent(f, scenario.override);
    if (scenario.label === "event subject identity missing") event = { ...event, subjectCardInstanceId: null };
    assert.equal(discover(f, event).queued.length, 0, `${entry.cardId}: ${scenario.label}`);
  }
  const wrongCircleEvent = "card.moved";
  const f = fixture();
  const moved = retireEvent(f, { type: wrongCircleEvent });
  assert.equal(discover(f, moved).queued.length, 0, "a generic move is not counted alongside the canonical retirement event");
  const sourceSelf = fixture();
  const selfEvent = retireEvent(sourceSelf, { cardInstanceId: sourceSelf.source.uid, subjectCardInstanceId: sourceSelf.source.uid, subjectOwnerPlayerId: sourceSelf.ownId, subjectControllerPlayerId: sourceSelf.ownId });
  assert.equal(discover(sourceSelf, selfEvent).queued.length, 0, "the source itself is not an opponent's retired Rear-Guard");
});

test("one retirement event is claimed once, while a distinct later retirement can trigger again", () => {
  const f = fixture({ side: "bot", entry: FAMILY[1] });
  const first = retireEvent(f);
  assert.equal(discover(f, first).queued.length, 1);
  assert.equal(discover(f, first).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  const opponent = f.state.players[f.otherSide];
  const next = make("cfa-14047", `second-victim-${f.side}`, f.otherId, { zone: "rear-guard", circle: "rear-right" });
  opponent.rear[1] = next;
  const second = Engine.createGameEvent(f.state, {
    type: "card.retired", actingPlayerId: f.ownId, turnPlayerId: f.ownId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownId, sourceControllerPlayerId: f.ownId,
    cardInstanceId: next.uid, subjectCardInstanceId: next.uid, subjectOwnerPlayerId: next.ownerPlayerId,
    subjectControllerPlayerId: next.controllerPlayerId, previousLocation: "rear-right", currentLocation: "drop",
    phase: "main", timingWindow: "ability-resolution"
  });
  opponent.rear[1] = null;
  opponent.drop.push(next);
  assert.equal(discover(f, second).queued.length, 1);
});

test("retire-target emits the exact moved card's event-time ownership and controller", () => {
  const source = make("cfa-493", "effect-source", "player-host");
  const victim = make("cfa-14047", "effect-victim", "player-guest");
  const targetPlayer = { playerId: "player-guest", rear: [victim], drop: [] };
  const emitted = [];
  const context = {
    targetPlayer, target: victim, targetSide: "bot", targetZone: "rear-left",
    targetOwnerPlayerId: "player-guest", targetControllerPlayerId: "player-guest",
    emitEvent: event => emitted.push(event)
  };
  assert.equal(Engine.EFFECT_HANDLERS["retire-target"].apply({}, context), true);
  assert.equal(targetPlayer.rear[0], null);
  assert.equal(targetPlayer.drop[0].uid, victim.uid);
  assert.deepEqual(emitted[0], {
    type: "card.retired", cardInstanceId: victim.uid, subjectCardInstanceId: victim.uid,
    subjectOwnerPlayerId: "player-guest", subjectControllerPlayerId: "player-guest",
    controllerSide: "bot", previousLocation: "rear-left", currentLocation: "drop"
  });
  assert.equal(source.controllerPlayerId, "player-host");
});
