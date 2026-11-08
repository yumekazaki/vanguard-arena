"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const curatedDefinitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(curatedDefinitions);
const definitions = require("./ability-contributions/batch-PRIMARY-CONTRIBUTION-REVIEW.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const abilityIds = ["cfa-996:0", "cfa-1608:1"];
const expectedText = "AUTO [RC]: During your battle phase, when this unit becomes stand, this unit gets power +3000 until end of turn.";

function instance(cardId, uid, playerId, extra = {}) {
  const card = cards.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || String(cardId), grade: Number(card?.grade || 0),
    power: Number(card?.power || 0), critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: true, rested: false, locked: false, ...extra };
}

function standFixture(cardId, side = "human", { phase = "battle", sourceLocation = "rear-left", subjectIsSource = true, turnPlayerId = null } = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance(cardId, `source-${cardId}-${side}`, playerId);
  const subject = subjectIsSource ? source : instance("cfa-1002", `other-${cardId}-${side}`, playerId);
  const opponentVanguard = instance("cfa-3", `opponent-vanguard-${side}`, opponentId);
  const own = { playerId, vanguard: sourceLocation === "vanguard" ? source : instance("cfa-3", `vanguard-${side}`, playerId),
    rear: sourceLocation === "rear-left" ? [source, subjectIsSource ? null : subject, null, null, null] : Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: Array(5).fill(null),
    soul: [], hand: [], deck: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `stand-family-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, turn: 3, side, phase: 5,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const location = subjectIsSource ? sourceLocation : "rear-right";
  const event = Engine.createGameEvent(state, { type: "unit.stood", actingPlayerId: playerId,
    turnPlayerId: turnPlayerId || playerId, cardInstanceId: subject.uid, subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: subject.ownerPlayerId, subjectControllerPlayerId: subject.controllerPlayerId,
    previousLocation: location, currentLocation: location, circle: location, phase, timingWindow: "stand-step",
    before: { rested: true }, after: { rested: false } });
  return { state, event, source, subject, side, playerId, abilityId: `${cardId}:${cardId === "cfa-996" ? 0 : 1}` };
}

function resolve(fixture, authUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid,
    actionId: `resolve-${fixture.abilityId}-${fixture.state.eventSequence}-${fixture.side}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.abilityId } }
  }, seats, Engine);
}

test("the exact two-card stand family reuses the reviewed source-specific handler", () => {
  assert.equal(definitions.filter(item => abilityIds.includes(item.id)).length, 2);
  for (const abilityId of abilityIds) {
    const definition = definitions.find(item => item.id === abilityId);
    const card = cards.get(definition.cardId);
    assert.ok(card && card.text.includes(expectedText), `${abilityId}: local catalog text matches`);
    assert.equal(definition.printedText, expectedText);
    assert.equal(definition.kind, "AUTO");
    assert.deepEqual(definition.requiredLocation, ["rear-guard"]);
    assert.deepEqual(definition.trigger, {
      status: "recognized-trigger", eventType: "unit.stood", subject: "event-subject", circles: ["rear-guard"],
      requiredPhase: "battle", turnRelation: "controller", subjectControllerRelation: "source-controller"
    });
    assert.deepEqual(definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);
    assert.ok(definition.source.officialReference);
  }
  assert.equal(definitions.find(item => item.id === "cfa-996:0").source.officialCardNumber, "BT09/033EN");
  assert.equal(definitions.find(item => item.id === "cfa-1608:1").source.officialCardNumber, "BT13/065");
});

test("both players receive and resolve their own exact Rear-Guard stand AUTO", () => {
  for (const abilityId of abilityIds) {
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    for (const side of ["human", "bot"]) {
      const f = standFixture(cardId, side);
      const ability = Engine.parseCardAbilities(cards.get(cardId)).find(item => item.id === abilityId);
      assert.ok(ability?.definition, `${abilityId}: registered in the production catalog`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true);

      const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(discovered.queued.length, 1, `${abilityId}/${side}: exact event queues once`);
      assert.equal(f.state.pendingAbility.side, side, `${abilityId}/${side}: owner receives the prompt`);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
      assert.equal(f.state.pendingAbility.eventContext.gameEvent.subjectCardInstanceId, f.source.uid);

      if (side === "bot") {
        assert.equal(resolve(f, seats.hostAuthUid).ok, false, "the host cannot resolve the joiner's AUTO");
      }
      const result = resolve(f);
      assert.equal(result.ok, true, `${abilityId}/${side}: ${result.reason || "resolves"}`);
      assert.equal(f.source.turnPowerBoost, 3000, `${abilityId}/${side}: exact source receives +3000`);
      assert.equal(f.source.power, Number(cards.get(cardId).power), "printed base power remains unchanged");
      assert.equal(f.state.pendingAbility, null, "the decision is consumed once");
    }
  }
});

test("the stand trigger rejects another card, wrong circle, wrong phase, and opponent turn", () => {
  for (const abilityId of abilityIds) {
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    const invalid = [
      standFixture(cardId, "human", { subjectIsSource: false }),
      standFixture(cardId, "human", { sourceLocation: "vanguard" }),
      standFixture(cardId, "human", { phase: "main" }),
      standFixture(cardId, "human", { turnPlayerId: "player-guest" })
    ];
    for (const f of invalid) {
      const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(result.queued.some(item => item.ability?.id === abilityId), false,
        `${abilityId}: ${f.event.currentLocation}/${f.event.phase}/${f.event.turnPlayerId} does not qualify`);
    }
  }
});

test("distinct stand events stack the printed bonus and turn end expires it", () => {
  const f = standFixture("cfa-996", "human");
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "the same event ID is not processed twice");
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 3000);

  const second = Engine.createGameEvent(f.state, { type: "unit.stood", actingPlayerId: f.playerId, turnPlayerId: f.playerId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid, subjectOwnerPlayerId: f.playerId,
    subjectControllerPlayerId: f.playerId, previousLocation: "rear-left", currentLocation: "rear-left",
    circle: "rear-left", phase: "battle", timingWindow: "stand-step", before: { rested: true }, after: { rested: false } });
  assert.notEqual(second.eventId, f.event.eventId);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [second], Engine).queued.length, 1, "a new stand event triggers again; text has no usage limit");
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 6000);

  f.state.pendingTurnEnd = { side: "human", playerId: f.playerId, cleanupQueued: true };
  Reducer.continueTurnEnd(f.state, Engine);
  assert.equal(f.source.turnPowerBoost, 0, "turn-end cleanup removes both temporary bonuses");
});
