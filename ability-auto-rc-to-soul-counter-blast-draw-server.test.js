"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Projection = require("./match-state-projection.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-11563";
const ABILITY_ID = `${CARD_ID}:0`;
const PATTERN = "auto-rc-to-soul-counter-blast-draw-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => String(card.id) === CARD_ID);
const ability = cardDefinition && Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);

function makeCard(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(card => String(card.id) === String(cardId));
  return {
    uid, cardId: String(cardId), cardName: definition?.name || String(cardId),
    grade: Number(definition?.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...extra
  };
}

function fixture(side = "human", { counterBlast = true, eventOverrides = {} } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const source = makeCard(CARD_ID, `blinklock-${side}`, ownerId, { zone: "soul" });
  const cause = makeCard("cfa-14", `cause-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const drawn = makeCard("cfa-3", `drawn-${side}`, ownerId);
  const remainder = makeCard("cfa-4", `remainder-${side}`, ownerId);
  const damage = counterBlast ? [makeCard("cfa-3", `damage-${side}`, ownerId, { zone: "damage", faceDown: false })] : [];
  const makePlayer = playerId => ({
    playerId,
    vanguard: makeCard("cfa-14", `vg-${playerId}`, playerId, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], bind: [], damage: [], orders: [],
    crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [], usedAbilities: []
  });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].vanguard = cause;
  players[side].soul.push(source);
  players[side].damage = damage;
  players[side].deck = [remainder, drawn];
  const state = {
    matchId: `blinklock-${side}`, stateVersion: 1, eventSequence: 0, turn: 4, phase: 6, side,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null, pendingEffectChoice: null,
    pendingAttack: null, players
  };
  const event = Engine.createGameEvent(state, {
    eventId: `move-${side}-source-to-soul`, type: "card.moved",
    actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: cause.uid, sourceCardName: cause.cardName,
    sourceOwnerPlayerId: cause.ownerPlayerId, sourceControllerPlayerId: cause.controllerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: source.ownerPlayerId, subjectControllerPlayerId: source.controllerPlayerId,
    previousLocation: "rear-left", currentLocation: "soul", phase: "main", timingWindow: "effect-resolution",
    ...eventOverrides
  });
  return { state, event, source, cause, drawn, remainder, side, ownerId, owner: players[side], opponent: players[side === "human" ? "bot" : "human"] };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }

function decide(f, { accept = true, actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `blinklock-${f.side}-${accept ? "accept" : "decline"}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor, actionId, expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response", accept,
      selection: {
        instanceUid: f.source.uid, abilityId: ABILITY_ID,
        costSelections: { cb: f.owner.damage.filter(card => !card.faceDown).slice(0, 1).map(card => card.uid), sb: [], discard: [], reveal: [] }
      }
    }
  }, seats, Engine);
}

test("Blinklock compiles as an exact event-subject trigger, not the card causing the move", () => {
  assert.ok(cardDefinition);
  assert.equal(ability.printedText, "AUTO: When this unit is put into soul from RC, COST [Counter Blast 1], and draw a card.");
  assert.equal(ability.definition.source.patternId, PATTERN);
  assert.equal(ability.trigger.eventType, "card.moved");
  assert.equal(ability.trigger.subject, "event-subject");
  assert.equal(ability.trigger.sourceLocation, "rear-guard");
  assert.equal(ability.trigger.destinationLocation, "soul");
  assert.equal(ability.canDecline, true);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
  assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }]);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);

  const scaled = Engine.parseCardAbilities({ id: "synthetic-rc-to-soul-cb-draw", text: "AUTO: When this unit is put into soul from RC, COST [Counter Blast 2], and draw a card." })[0];
  assert.equal(scaled.definition.source.patternId, PATTERN);
  assert.equal(scaled.trigger.subject, "event-subject");
  assert.deepEqual(scaled.costs, [{ type: "counter-blast", count: 2 }]);
  assert.equal(Reducer.supportsServerAbilityEffects(scaled), true);
});

test("the exact moved unit prompts and resolves for its controller on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    assert.notEqual(f.event.sourceCardInstanceId, f.source.uid, "the effect source can be a different card");
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.ok(Projection.projectForPlayer(f.state, f.ownerId).pendingAbility);
    assert.equal(Projection.projectForPlayer(f.state, f.opponent.playerId).pendingAbility, null);

    const forged = decide(f, { actor: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `forged-${side}` });
    assert.equal(forged.ok, false);
    const resolved = decide(f, { actionId: `resolve-${side}` });
    assert.equal(resolved.ok, true, JSON.stringify(resolved));
    assert.equal(f.owner.damage[0].faceDown, true, "Counter Blast is paid by the source controller");
    assert.deepEqual(f.owner.hand.map(card => card.uid), [f.drawn.uid]);
    assert.equal(f.owner.deck.length, 1);
    assert.equal(f.owner.deck[0].uid, f.remainder.uid);
    assert.equal(f.opponent.hand.length, 0);
    assert.deepEqual(resolved.events.map(event => event.type), ["card.drawn"]);
    assert.equal(discover(f).queued.length, 0, "replaying the same event cannot prompt again");
  }
});

test("a different event subject, wrong move direction, or mismatched card instance cannot trigger", () => {
  const unrelated = fixture("human", { eventOverrides: { cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" } });
  assert.equal(discover(unrelated).queued.length, 0);
  const wrongInstance = fixture("human", { eventOverrides: { cardInstanceId: "other-copy" } });
  assert.equal(discover(wrongInstance).queued.length, 0);
  const fromHand = fixture("human", { eventOverrides: { previousLocation: "hand" } });
  assert.equal(discover(fromHand).queued.length, 0);
  const fromVanguard = fixture("human", { eventOverrides: { previousLocation: "vanguard" } });
  assert.equal(discover(fromVanguard).queued.length, 0);
  const toDrop = fixture("human", { eventOverrides: { currentLocation: "drop" } });
  assert.equal(discover(toDrop).queued.length, 0);
});

test("an unpayable Counter Blast cannot partially resolve, and the optional trigger can be declined", () => {
  const f = fixture("human", { counterBlast: false });
  assert.equal(discover(f).queued.length, 1);
  const before = JSON.stringify(f.state);
  const unpaid = decide(f, { actionId: "unpayable-accept" });
  assert.equal(unpaid.ok, false);
  assert.equal(JSON.stringify(f.state), before);
  const declined = decide(f, { accept: false, actionId: "decline-unpayable" });
  assert.equal(declined.ok, true, JSON.stringify(declined));
  assert.equal(f.owner.hand.length, 0);
  assert.equal(f.owner.deck.length, 2);
  assert.equal(f.owner.damage.length, 0);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(discover(f).queued.length, 0, "declining cannot reopen the same move event");
});

test("the source is rechecked at resolution, so stale Soul location leaves resources unchanged", () => {
  const f = fixture("bot");
  assert.equal(discover(f).queued.length, 1);
  f.owner.soul = f.owner.soul.filter(card => card.uid !== f.source.uid);
  f.owner.drop.push({ ...f.source, zone: "drop" });
  const before = JSON.stringify(f.state);
  const result = decide(f, { actionId: "reject-stale-source" });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.owner.damage[0].faceDown, false);
  assert.equal(f.owner.hand.length, 0);
});

