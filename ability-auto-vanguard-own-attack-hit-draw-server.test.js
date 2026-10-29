"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-6634", "cfa-7013", "cfa-7966", "cfa-8073", "cfa-8106"];
const TEXT = "AUTO [VC]: When its attack hits, draw a card.";
const PATTERN = "auto-vanguard-own-attack-hit-draw-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(uid, cardId, playerId) {
  const row = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: row?.name || "Test Unit", type: row?.type || "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human") {
  const row = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const opponent = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const defenderId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(`attacker-${n}`, cardId, ownerId), target = card(`target-${n}`, "cfa-3", defenderId);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  players[opponent].vanguard = target;
  const battleId = `battle-${n}`;
  const state = { matchId: "vanguard-own-attack-hit-draw", stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: source.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: "vanguard", targetUid: target.uid, targetZone: "vanguard", defenderSide: opponent, power: 20000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderId, subjectControllerPlayerId: defenderId,
    targetCardInstanceIds: [target.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid,
    battleId, phase: "battle", timingWindow: "attack-hit" });
  const drawn = card(`draw-${n}`, "cfa-2", ownerId);
  players[side].deck = [drawn];
  return { state, ability, event, source, target, drawn, side, ownerId, defenderId, battleId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, { auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, event = f.event } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-hit-draw-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("five catalog entries have the same exact Vanguard own-hit text and their other abilities remain distinct", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id);
    assert.ok(row, id);
    const abilities = Engine.parseCardAbilitiesCached(row);
    const ability = abilities.find(item => item.id === `${id}:0`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["vanguard"], id);
    assert.equal(ability.trigger.eventType, "attack.hit", id);
    assert.equal(ability.trigger.subject, "source", id);
    assert.deepEqual(ability.costs, [], id);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.equal(abilities.filter(item => item.id !== ability.id).length, Math.max(0, abilities.length - 1), id);
  }
});

test("the Vanguard owner resolves their own hit draw from either online seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    const found = discover(f);
    assert.equal(found.queued.length, 1, JSON.stringify(found));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discover(f).queued.length, 0, "replayed event must not queue a duplicate ability");
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].hand, [f.drawn]);
    assert.equal(f.state.players[side].deck.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn"]);
  }
});

test("another unit hitting, bad battle metadata, stale source, forged definitions, and host-proxy resolution are rejected", () => {
  const unrelated = fixture();
  const other = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: undefined, sourceCardInstanceId: "other", attackingUnitInstanceId: "other" });
  assert.equal(discover(unrelated, other).queued.length, 0);

  for (const change of [
    { timingWindow: "attack-declaration" },
    { battleId: "different-battle" },
    { sourceControllerPlayerId: "guest-player" }
  ]) {
    const f = fixture();
    const bad = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, bad).queued.length, 0);
  }

  const stale = fixture();
  stale.state.players[stale.side].vanguard = null;
  stale.state.players[stale.side].rear[0] = stale.source;
  assert.equal(discover(stale).queued.length, 0);

  const proxy = fixture(IDS[0], "bot");
  assert.equal(discover(proxy).queued.length, 1);
  const result = resolve(proxy, { auth: seats.hostAuthUid });
  assert.equal(result.ok, false);
  assert.equal(proxy.state.players.bot.hand.length, 0);
  assert.deepEqual(proxy.state.players.bot.deck, [proxy.drawn]);

  const f = fixture();
  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("draw a card", "draw two cards"); },
    ability => { ability.requiredLocation = ["rear-guard"]; },
    ability => { ability.trigger.subject = "controller"; },
    ability => { ability.definition.effects[0].count = 2; },
    ability => { ability.definition.id = "cfa-7013:0"; }
  ]) {
    const forged = structuredClone(f.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
