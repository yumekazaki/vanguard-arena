"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CONTRIBUTIONS = [
  require("./ability-contributions/batch-ABILITY-76D8A0B8-0322.js"),
  require("./ability-contributions/batch-ABILITY-76D8A0B8-0325.js"),
  require("./ability-contributions/batch-ABILITY-76D8A0B8-0328.js")
].flat();
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerAbilityDefinitions(CONTRIBUTIONS);

const FAMILY = [
  { cardId: "cfa-750", abilityId: "cfa-750:0", name: "Savage Warrior", cardNumber: "BT03/035EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT03%2F035EN" },
  { cardId: "cfa-761", abilityId: "cfa-761:0", name: "Savage Destroyer", cardNumber: "BT03/058EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT03%2F058EN" },
  { cardId: "cfa-770", abilityId: "cfa-770:0", name: "Ravenous Dragon, Gigarex", cardNumber: "BT03/004EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT03%2F004EN" }
];
const PATTERN = "auto-vc-rc-during-turn-friendly-tachikaze-rearguard-drop-power-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();
const cardFor = id => CATALOG.find(card => String(card.id) === String(id));
const cardClans = (card, fallback = "Tachikaze") => {
  const line = String(card?.text || "").split(/\r?\n/, 1)[0];
  const clan = String(card?.clan || card?.clans?.[0] || line.split("/")[0] || fallback);
  return { clan, clans: Array.isArray(card?.clans) && card.clans.length ? [...card.clans] : [clan] };
};
const player = playerId => ({
  playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], bind: [],
  damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], usedAbilities: []
});

function instance(cardId, uid, ownerPlayerId, controllerPlayerId, zone, circle, clanOverride = null) {
  const definition = cardFor(cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  const identity = cardClans(definition);
  const clan = clanOverride || identity.clan;
  return {
    uid, cardId: String(cardId), cardName: definition.name, grade: Number(definition.grade || 0),
    power: Number(definition.power || 0), ownerPlayerId, controllerPlayerId, unitCard: true,
    clan, clans: clanOverride ? [clan] : identity.clans, zone, circle, rested: false, faceUp: true
  };
}

function fixture({
  side = "human", cardId = FAMILY[0].cardId, sourceZone = "vanguard", phase = 5,
  subjectController = "source", subjectOwner = "source", subjectClan = "Tachikaze", subjectCardId = FAMILY[0].cardId
} = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const opponentSide = side === "human" ? "bot" : "human";
  const own = player(playerId), opponent = player(opponentId);
  const source = instance(cardId, `source-${side}-${cardId}`, playerId, playerId, sourceZone === "vanguard" ? "vanguard" : "rear-guard", sourceZone);
  // Keep the rear-guard test source unique. A second copy of the same card on
  // VC would correctly create a second AUTO instance for the same event.
  const ownVanguard = sourceZone === "vanguard" ? source : instance("cfa-1", `own-vg-${side}-${cardId}`, playerId, playerId, "vanguard", "vanguard");
  const opposingVanguard = instance(cardId, `opponent-vg-${side}-${cardId}`, opponentId, opponentId, "vanguard", "vanguard");
  own.vanguard = ownVanguard;
  opponent.vanguard = opposingVanguard;
  if (sourceZone !== "vanguard") own.rear[0] = source;

  const controllerSide = subjectController === "source" ? side : opponentSide;
  const controllerPlayer = controllerSide === side ? own : opponent;
  const subjectControllerPlayerId = controllerPlayer.playerId;
  const subjectOwnerPlayerId = subjectOwner === "source" ? playerId : opponentId;
  const subject = instance(subjectCardId, `subject-${side}-${cardId}`, subjectOwnerPlayerId, subjectControllerPlayerId,
    "rear-guard", "rear-right", subjectClan);
  controllerPlayer.rear[controllerSide === side && sourceZone !== "vanguard" ? 1 : 0] = subject;
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = {
    matchId: `tachikaze-drop-${side}-${cardId}`, stateVersion: 1, turn: 2, side, phase,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players
  };
  const ability = Engine.parseCardAbilitiesCached(cardFor(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 parsed from the catalog`);
  return { state, side, playerId, opponentId, opponentSide, own, opponent, source, subject, subjectControllerPlayerId, subjectOwnerPlayerId, ability };
}

function putSubjectIntoDrop(f, { type = "card.retired", previousLocation = "rear-right", currentLocation = "drop", turnPlayerId = f.playerId } = {}) {
  const location = f.state.players[f.side].rear.findIndex(card => card?.uid === f.subject.uid) >= 0
    ? f.state.players[f.side] : f.state.players[f.opponentSide];
  const index = location.rear.findIndex(card => card?.uid === f.subject.uid);
  if (index >= 0) location.rear[index] = null;
  location.drop.push(f.subject);
  f.subject.zone = "drop";
  f.subject.circle = null;
  return Engine.createGameEvent(f.state, {
    type, actingPlayerId: f.playerId, turnPlayerId,
    sourceCardInstanceId: f.subject.uid, sourceOwnerPlayerId: f.subject.ownerPlayerId,
    sourceControllerPlayerId: f.subject.controllerPlayerId,
    cardInstanceId: f.subject.uid, subjectCardInstanceId: f.subject.uid,
    subjectOwnerPlayerId: f.subject.ownerPlayerId, subjectControllerPlayerId: f.subject.controllerPlayerId,
    previousLocation, currentLocation, phase: f.state.phase === 5 ? "battle" : "main",
    timingWindow: "ability-resolution"
  });
}

function discover(f, event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, authUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId = `resolve-${f.ability.id}-${f.side}`) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: pending?.ability?.id || f.ability.id } }
  }, SEATS, Engine);
}

test("the three exact BT03 abilities retain separate IDs, sources, and common structured rules", () => {
  assert.deepEqual(CONTRIBUTIONS.map(item => item.id).sort(), FAMILY.map(item => item.abilityId).sort());
  for (const entry of FAMILY) {
    const card = cardFor(entry.cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === entry.abilityId);
    assert.ok(card.text.includes(ability.printedText), `${entry.abilityId}: exact catalog wording`);
    assert.equal(card.name, entry.name);
    assert.equal(ability.definition.source.officialCardNumber, entry.cardNumber);
    assert.deepEqual(ability.definition.source.officialReferences, [entry.reference]);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.trigger.eventType, "card.moved");
    assert.deepEqual(ability.trigger.anyOf, [{ eventType: "card.moved" }, { eventType: "card.retired" }]);
    assert.equal(ability.trigger.subject, "different-card");
    assert.equal(ability.trigger.sourceLocation, "rear-guard");
    assert.equal(ability.trigger.destinationLocation, "drop");
    assert.equal(ability.trigger.excludeSourceAsSubject, true);
    assert.equal(ability.trigger.subjectControllerRelation, "source-controller");
    assert.equal(ability.trigger.turnRelation, "controller");
    assert.deepEqual(ability.conditions, [
      { type: "controller-turn" },
      { type: "event-subject-has-clan", value: "Tachikaze" }
    ]);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 1000, duration: "turn" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("each ability resolves from VC or RC for its controller, from both moved and retired events, for either seat", () => {
  for (const entry of FAMILY) for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-guard"]) for (const type of ["card.moved", "card.retired"]) {
    const f = fixture({ side, cardId: entry.cardId, sourceZone, phase: sourceZone === "vanguard" ? 5 : 4 });
    const event = putSubjectIntoDrop(f, { type });
    const found = discover(f, event);
    assert.equal(found.queued.length, 1, `${entry.abilityId}/${side}/${sourceZone}/${type}: ${JSON.stringify(found.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    const wrongAuthUid = side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid;
    assert.equal(resolve(f, wrongAuthUid, `wrong-seat-${entry.abilityId}-${side}`).ok, false, "opponent cannot resolve this player's AUTO");
    assert.equal(resolve(f).ok, true, `${entry.abilityId}/${side}: source controller resolves it`);
    assert.equal(f.source.turnPowerBoost, 1000);
    assert.equal(f.source.turnPowerExpiry, f.playerId);
    assert.equal(f.source.power, Number(cardFor(entry.cardId).power), "base power is not overwritten");
    assert.equal(f.subject.turnPowerBoost, undefined, "the moved event subject does not receive the source's effect");
  }
});

test("wrong subject clan, controller, origin, destination, turn, or identity cannot activate", () => {
  const cases = [
    { label: "non-Tachikaze rear-guard", setup: { subjectClan: "Kagero" }, event: {} },
    { label: "opponent-controlled Tachikaze", setup: { subjectController: "opponent" }, event: {} },
    { label: "not from a Rear-Guard Circle", setup: {}, event: { previousLocation: "hand" } },
    { label: "not put in Drop", setup: {}, event: { currentLocation: "bind" } },
    { label: "not the controller's turn", setup: {}, event: { turnPlayerId: "player-guest" } }
  ];
  for (const entry of FAMILY) for (const scenario of cases) {
    const f = fixture({ cardId: entry.cardId, ...scenario.setup });
    const event = putSubjectIntoDrop(f, scenario.event);
    assert.equal(discover(f, event).queued.length, 0, `${entry.abilityId}: ${scenario.label}`);
    assert.equal(f.state.pendingAbility, null);
  }

  const f = fixture();
  const event = putSubjectIntoDrop(f);
  assert.equal(discover(f, { ...event, subjectCardInstanceId: "forged-subject" }).queued.length, 0, "forged/nonexistent subject instance is rejected");
  assert.equal(discover(f, { ...event, cardInstanceId: "different-card" }).queued.length, 0, "card ID and subject ID must agree");
  assert.equal(discover(f, { ...event, subjectCardInstanceId: null }).queued.length, 0, "missing subject identity cannot qualify");

  const sourceOutOfPlay = fixture({ sourceZone: "rear-guard" });
  sourceOutOfPlay.own.rear[0] = null;
  sourceOutOfPlay.own.drop.push(sourceOutOfPlay.source);
  sourceOutOfPlay.source.zone = "drop";
  sourceOutOfPlay.source.circle = null;
  const sourceEvent = putSubjectIntoDrop(sourceOutOfPlay, { previousLocation: "rear-left" });
  assert.equal(discover(sourceOutOfPlay, sourceEvent).queued.length, 0, "a source that left its VC/RC cannot activate its field ability");
});

test("controller identity is used separately from ownership for the qualifying rear-guard", () => {
  const f = fixture({ subjectOwner: "opponent", subjectController: "source" });
  const event = putSubjectIntoDrop(f);
  assert.equal(event.subjectOwnerPlayerId, f.opponentId);
  assert.equal(event.subjectControllerPlayerId, f.playerId);
  assert.equal(discover(f, event).queued.length, 1, "a Tachikaze rear-guard controlled by this player qualifies even if owned by the opponent");
  assert.equal(f.state.pendingAbility.side, f.side);
});

test("the exact source and event are claimed once; later qualifying events stack, then expire at turn end", () => {
  const f = fixture({ side: "bot", cardId: FAMILY[2].cardId, sourceZone: "rear-guard" });
  const first = putSubjectIntoDrop(f);
  assert.equal(discover(f, first).queued.length, 1);
  assert.equal(discover(f, first).queued.length, 0, "duplicate delivery of one event is not queued twice");
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 1000);

  const secondSubject = instance(FAMILY[1].cardId, "second-subject", f.playerId, f.playerId, "rear-guard", "rear-center");
  f.own.rear[2] = secondSubject;
  f.subject = secondSubject;
  const second = putSubjectIntoDrop(f, { type: "card.moved", previousLocation: "rear-center" });
  assert.equal(discover(f, second).queued.length, 1, "a separate qualifying event creates another AUTO activation");
  assert.equal(resolve(f, SEATS.guestAuthUid, "resolve-second-source-ability").ok, true);
  assert.equal(f.source.turnPowerBoost, 2000, "the two turn-duration boosts accumulate");
  Engine.expireTurnModifiers(f.state, f.playerId);
  assert.equal(f.source.turnPowerBoost, 0, "turn-end cleanup removes all accumulated power");
});
