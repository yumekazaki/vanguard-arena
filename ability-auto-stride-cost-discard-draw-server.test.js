"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [["cfa-12191", 1], ["cfa-12194", 1], ["cfa-13178", 2]];
const PATTERN = "auto-stride-cost-discard-draw-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();
const byId = id => CATALOG.find(card => String(card.id) === String(id));
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], usedAbilities: [] });

function fixture({ family = FAMILY[0], side = "bot" } = {}) {
  const [cardId, abilityIndex] = family, definition = byId(cardId);
  assert.ok(definition, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:${abilityIndex}`);
  assert.ok(ability, `catalog ability ${cardId}:${abilityIndex} exists`);
  const ownId = side === "human" ? "host-player" : "guest-player", opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}-${cardId}`, cardId, ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true };
  const topDefinition = CATALOG.find(card => /unit/i.test(String(card.type)) && card.id !== cardId);
  assert.ok(topDefinition, "catalog has a card to draw");
  const top = { uid: `top-${side}`, cardId: topDefinition.id, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const own = player(ownId), opponent = player(opponentId);
  own.drop.push(source); own.deck.push(top);
  const state = { matchId: `stride-cost-draw-${side}-${cardId}`, stateVersion: 1, turn: 4,
    side: side === "human" ? "bot" : "human", phase: 3, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.discarded", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId,
    subjectControllerPlayerId: ownId, previousLocation: "hand", currentLocation: "drop",
    discardReason: "stride-cost", phase: "stride", timingWindow: "stride-cost" });
  return { state, ability, source, top, side, ownId, opponentId, event };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, actor = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId: `resolve-${f.side}-${f.ability.id}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, SEATS, Engine);
}

test("all three exact Stride-cost AUTO definitions retain the event-only draw condition", () => {
  for (const [cardId, index] of FAMILY) {
    const f = fixture({ family: [cardId, index] });
    assert.equal(f.ability.definition?.source?.patternId, PATTERN, cardId);
    assert.equal(f.ability.id, `${cardId}:${index}`);
    assert.equal(f.ability.kind, "AUTO");
    assert.equal(f.ability.canDecline, false);
    assert.deepEqual(f.ability.costs, []);
    assert.deepEqual(f.ability.definition.effects, [{ op: "draw", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player each resolve their own exact Stride-cost draw", () => {
  for (const side of ["human", "bot"]) {
    for (const family of FAMILY) {
      const f = fixture({ family, side });
      assert.equal(discover(f).queued.length, 1, `${side}:${family[0]}`);
      assert.equal(f.state.pendingAbility.side, side);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
      assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
      const forged = decide(f, side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid);
      assert.equal(forged.ok, false, `${side}:${family[0]} forged actor`);
      assert.equal(f.state.players[side].deck.length, 1);
      const resolved = decide(f);
      assert.equal(resolved.ok, true, resolved.reason);
      assert.equal(f.state.players[side].deck.length, 0);
      assert.equal(f.state.players[side].hand[0].uid, f.top.uid);
      assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
      assert.equal(decide(f).reason, "duplicate-action");
    }
  }
});

test("Stride-cost draw rejects wrong reason, phase, source instance, owner, and ordinary discards", () => {
  const cases = [
    { discardReason: "ordinary-cost" },
    { phase: "main" },
    { sourceCardInstanceId: "other-copy", cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" },
    { sourceOwnerPlayerId: "opponent-player", subjectOwnerPlayerId: "opponent-player" },
    { previousLocation: "soul" },
    { currentLocation: "bind" },
    { actingPlayerId: "opponent-player", sourceControllerPlayerId: "opponent-player", subjectControllerPlayerId: "opponent-player" },
    { turnPlayerId: "opponent-player" }
  ];
  for (const changes of cases) {
    const f = fixture();
    const event = Engine.createGameEvent(f.state, { ...f.event, ...changes, eventId: undefined });
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(changes));
  }
});

test("Stride-cost discards in both local app paths carry the exact cause and timing window", () => {
  const fs = require("node:fs"), app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  assert.match(app, /choice\.payment\.forEach\(cost=>queueMovedCardAbility\(cost,"bot","discard","hand",\{discardReason:"stride-cost",timingWindow:"stride-cost"\}\)\)/);
  assert.match(app, /payment\.forEach\(cost=>queueMovedCardAbility\(cost,"human","discard","hand",\{discardReason:"stride-cost",timingWindow:"stride-cost"\}\)\)/);
});
