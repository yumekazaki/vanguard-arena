"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const PATTERN = "auto-vc-rc-opponent-rearguard-retired-turn-power-v1";
const FAMILY = [
  { cardId: "cfa-5676", abilityId: "cfa-5676:1", name: "Vortex Dragon", cardNumber: "V-BT01/033EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT01%2F033EN", amount: 5000 },
  { cardId: "cfa-5733", abilityId: "cfa-5733:0", name: "Bellicosity Dragon", cardNumber: "V-BT01/035EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT01%2F035EN", amount: 5000 },
  { cardId: "cfa-5734", abilityId: "cfa-5734:0", name: "Lizard Soldier, Raopia", cardNumber: "V-BT01/036EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT01%2F036EN", amount: 5000 }
];
const PRINTED = "AUTO [VC/RC]: When your opponent’s rear-guard is retired during your turn, this unit gets power +5000 until end of turn.";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = cardId => CATALOG.find(card => String(card.id) === String(cardId));

function make(cardId, uid, playerId, extra = {}) {
  const definition = cardFor(cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  return {
    uid, cardId: String(definition.id), cardName: definition.name, name: definition.name,
    type: definition.type, grade: Number(definition.grade), power: Number(definition.power || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function fixture({ side = "human", entry = FAMILY[0], sourceZone = "rear-left", phase = "battle" } = {}) {
  const controllerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const sourceOnVanguard = sourceZone === "vanguard";
  const source = make(entry.cardId, `ability-source-${side}-${entry.cardId}`, controllerId, {
    zone: sourceOnVanguard ? "vanguard" : "rear-guard", circle: sourceOnVanguard ? "vanguard" : sourceZone
  });
  const ownVanguard = sourceOnVanguard ? source : make("cfa-14047", `vg-${side}`, controllerId, { zone: "vanguard", circle: "vanguard" });
  const opponentVanguard = make("cfa-14047", `vg-${opponentSide}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const retireActor = make("cfa-14047", `retire-actor-${side}`, controllerId, { zone: "rear-guard", circle: sourceOnVanguard ? "rear-left" : "rear-right" });
  const victim = make("cfa-14047", `victim-${side}`, opponentId, { zone: "rear-guard", circle: "rear-left" });
  const player = (playerId, vanguard) => ({
    playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [],
    drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [],
    triggerZone: [], guardCircle: [], usedAbilities: []
  });
  const own = player(controllerId, ownVanguard), opponent = player(opponentId, opponentVanguard);
  if (sourceOnVanguard) own.rear[0] = retireActor;
  else { own.rear[0] = source; own.rear[1] = retireActor; }
  opponent.rear[0] = victim;
  const state = {
    matchId: `vc-rc-opponent-retire-${side}-${entry.cardId}-${sourceZone}`,
    stateVersion: 1, turn: 1, phase: phase === "battle" ? 5 : 4, side,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [],
    pendingAbilities: [], pendingAbility: null,
    players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent }
  };
  const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parsed`);
  return { state, source, retireActor, victim, ability, side, controllerId, opponentId, opponentSide, entry };
}

function retireOpponentRearGuard(f, overrides = {}) {
  const opponent = f.state.players[f.opponentSide];
  const [victim] = opponent.rear.splice(0, 1, null);
  opponent.drop.push(victim);
  return Engine.createGameEvent(f.state, {
    type: "card.retired", actingPlayerId: f.controllerId, turnPlayerId: f.controllerId,
    sourceCardInstanceId: f.retireActor.uid, sourceOwnerPlayerId: f.controllerId,
    sourceControllerPlayerId: f.controllerId,
    cardInstanceId: victim.uid, subjectCardInstanceId: victim.uid,
    subjectOwnerPlayerId: victim.ownerPlayerId, subjectControllerPlayerId: victim.controllerPlayerId,
    previousLocation: "rear-left", currentLocation: "drop", phase: "battle",
    timingWindow: "ability-resolution", ...overrides
  });
}

function discover(f, event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, actionId = `resolve-${f.side}-${f.entry.cardId}-${f.source.uid}`) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response", accept: true,
      selection: { instanceUid: f.source.uid, abilityId: pending?.ability?.id || f.ability.id,
        costSelections: { cb: [], sb: [], discard: [], reveal: [] } }
    }
  }, SEATS, Engine);
}

test("catalog family compiles a strict mandatory VC/RC retirement trigger", () => {
  for (const entry of FAMILY) {
    const card = cardFor(entry.cardId);
    assert.equal(card.name, entry.name);
    assert.ok(card.text.includes(PRINTED), `${entry.cardId} preserves the exact catalog wording`);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === entry.abilityId);
    assert.ok(ability?.definition, `${entry.abilityId} has a structured definition`);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.trigger, {
      status: "recognized-trigger", eventType: "card.retired", subject: "different-card", circles: [],
      sourceLocation: "rear-guard", destinationLocation: "drop", subjectControllerRelation: "opponent",
      turnRelation: "controller"
    });
    assert.deepEqual(ability.conditions, []);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.canDecline, false);
    assert.equal(ability.definition.optional, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]);
    assert.equal(ability.definition.source.officialCardNumber, entry.cardNumber);
    assert.equal(ability.definition.source.officialReference, entry.reference);
    assert.deepEqual(ability.definition.source.officialReferences, [entry.reference]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  assert.equal(Engine.parseCardAbilitiesCached(cardFor("cfa-5676")).length, 2,
    "Vortex Dragon's separate ACT is left outside this AUTO family");
});

test("the exact source on VC or RC triggers for either seat, including outside Main Phase", () => {
  for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-left"]) for (const entry of FAMILY) {
    const f = fixture({ side, entry, sourceZone, phase: "battle" });
    const event = retireOpponentRearGuard(f);
    assert.equal(discover(f, event).queued.length, 1, `${side}/${sourceZone}/${entry.cardId}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.controllerId);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.source.turnPowerBoost, 5000);
    assert.equal(f.source.turnPowerExpiry, f.controllerId);
    assert.equal(f.source.power, Number(cardFor(entry.cardId).power), "the base power remains authoritative");
    assert.equal(f.retireActor.turnPowerBoost || 0, 0, "the event's effect source does not receive this AUTO's modifier");
    Engine.expireTurnModifiers(f.state.players, f.controllerId);
    assert.equal(f.source.turnPowerBoost, 0, "the +5000 expires at the end of the controller's turn");
    assert.equal(f.source.turnPowerExpiry, undefined);
  }
});

test("friendly, non-Rear-Guard, non-retirement, wrong-turn, and mismatched-instance events are rejected", () => {
  const scenarios = [
    { label: "friendly unit retired", event(f) { const own=f.state.players[f.side],victim=make("cfa-14047",`friendly-${f.side}`,f.controllerId,{zone:"rear-guard",circle:"rear-right"});own.rear[4]=victim;own.rear[4]=null;own.drop.push(victim);return Engine.createGameEvent(f.state,{type:"card.retired",actingPlayerId:f.controllerId,turnPlayerId:f.controllerId,sourceCardInstanceId:f.retireActor.uid,sourceOwnerPlayerId:f.controllerId,sourceControllerPlayerId:f.controllerId,cardInstanceId:victim.uid,subjectCardInstanceId:victim.uid,subjectOwnerPlayerId:victim.ownerPlayerId,subjectControllerPlayerId:victim.controllerPlayerId,previousLocation:"rear-right",currentLocation:"drop",phase:"battle",timingWindow:"ability-resolution"});} },
    { label: "non-Rear-Guard source location", event: f => retireOpponentRearGuard(f, { previousLocation: "hand" }) },
    { label: "non-Drop destination", event: f => retireOpponentRearGuard(f, { currentLocation: "bind" }) },
    { label: "wrong turn player", event: f => retireOpponentRearGuard(f, { turnPlayerId: f.opponentId }) },
    { label: "generic move is not a retirement", event: f => retireOpponentRearGuard(f, { type: "card.moved" }) },
    { label: "event card and subject identities differ", event: f => retireOpponentRearGuard(f, { cardInstanceId: "different-victim-instance" }) },
    { label: "source cannot trigger from its own retirement", event(f) { const own=f.state.players[f.side],source=f.source,previousLocation=source.zone==="vanguard"?"vanguard":source.circle;if(own.vanguard.uid===source.uid)own.vanguard=make("cfa-14047",`replacement-vg-${f.side}`,f.controllerId,{zone:"vanguard",circle:"vanguard"});else own.rear=own.rear.map(card=>card?.uid===source.uid?null:card);own.drop.push(source);return Engine.createGameEvent(f.state,{type:"card.retired",actingPlayerId:f.controllerId,turnPlayerId:f.controllerId,sourceCardInstanceId:f.retireActor.uid,sourceOwnerPlayerId:f.controllerId,sourceControllerPlayerId:f.controllerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:source.ownerPlayerId,subjectControllerPlayerId:source.controllerPlayerId,previousLocation,currentLocation:"drop",phase:"battle",timingWindow:"ability-resolution"});} }
  ];
  for (const scenario of scenarios) {
    const f = fixture({ entry: FAMILY[1] });
    const event = scenario.event(f);
    assert.equal(discover(f, event).queued.length, 0, scenario.label);
  }
});

test("duplicate event IDs are ignored, distinct retirements stack, and each trigger resolves once", () => {
  const f = fixture({ side: "bot", entry: FAMILY[0], sourceZone: "rear-left" });
  const first = retireOpponentRearGuard(f);
  assert.equal(discover(f, first).queued.length, 1);
  assert.equal(discover(f, first).queued.length, 0, "the same event cannot queue the AUTO twice");
  assert.equal(resolve(f, "resolve-first-retirement").ok, true);
  assert.equal(f.source.turnPowerBoost, 5000);

  const opponent = f.state.players[f.opponentSide];
  const secondVictim = make("cfa-14047", "second-opponent-victim", f.opponentId, { zone: "rear-guard", circle: "rear-right" });
  opponent.rear[1] = secondVictim;
  const [moved] = opponent.rear.splice(1, 1, null);
  opponent.drop.push(moved);
  const second = Engine.createGameEvent(f.state, {
    type: "card.retired", actingPlayerId: f.controllerId, turnPlayerId: f.controllerId,
    sourceCardInstanceId: f.retireActor.uid, sourceOwnerPlayerId: f.controllerId,
    sourceControllerPlayerId: f.controllerId, cardInstanceId: moved.uid, subjectCardInstanceId: moved.uid,
    subjectOwnerPlayerId: moved.ownerPlayerId, subjectControllerPlayerId: moved.controllerPlayerId,
    previousLocation: "rear-right", currentLocation: "drop", phase: "battle", timingWindow: "ability-resolution"
  });
  assert.notEqual(second.eventId, first.eventId);
  assert.equal(discover(f, second).queued.length, 1, "the ability has no once-per-turn limit");
  assert.equal(resolve(f, "resolve-second-retirement").ok, true);
  assert.equal(f.source.turnPowerBoost, 10000, "each distinct retirement applies another +5000");
});
