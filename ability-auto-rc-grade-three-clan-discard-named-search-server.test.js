"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const META = require("./card-authoritative-rules-metadata.js").byId;
const FAMILY = [["cfa-12", "Shadow Paladin", "Phantom Blaster Dragon"], ["cfa-58", "Megacolony", "Evil Armor General, Giraffa"], ["cfa-124", "Nova Grappler", "Stern Blaukluger"], ["cfa-242", "Dimension Police", "Enigman Storm"], ["cfa-505", "Kagero", "Amber Dragon, Eclipse"]];
const CATALOG = loadCatalog();
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const inst = (cardId, uid, playerId, extra = {}) => ({ uid, cardId, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra });
function fixture(cardId, side = "bot", includeDiscard = true) {
  const [clan, targetName] = FAMILY.find(([id]) => id === cardId).slice(1);
  const card = CATALOG.find(item => String(item.id) === cardId);
  const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `ability definition for ${cardId}`);
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentId = side === "human" ? "guest-player" : "host-player";
  const own = { playerId: ownerId, vanguard: inst("cfa-3", `vg-${side}`, ownerId), rear: Array(5).fill(null), hand: [], deck: [], drop: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], drop: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const source = inst(cardId, `source-${side}`, ownerId, { type: card.type, grade: card.grade, clan: card.clan });
  own.rear[0] = source;
  const discardId = Object.keys(META).find(id => Number(META[id].grade) === 3 && [META[id].clan, ...(META[id].clans || [])].includes(clan));
  assert.ok(discardId, `trusted Grade 3 ${clan} discard exists`);
  const discard = inst(discardId, `discard-${side}`, ownerId, { grade: 0, clan: "forged client metadata" });
  if (includeDiscard) own.hand.push(discard);
  const targetId = Object.keys(META).find(id => META[id].name === targetName);
  assert.ok(targetId, `trusted target ${targetName} exists`);
  const target = inst(targetId, `target-${side}`, ownerId);
  own.deck.push(target);
  const state = { matchId: `rc-filter-search-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: "rear-left", circle: "rear-guard", phase: "main", timingWindow: "normal-call" });
  return { state, event, ability, source, discard, target, side, ownerId };
}
function decide(f, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.state.matchId}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid: f.target.uid, costSelections: { discard: [f.discard.uid] } } } }, SEATS, Engine);
}

test("five exact RC placement searches are trusted and cost-filtered for each player", () => {
  for (const [cardId, clan, target] of FAMILY) {
    for (const side of ["human", "bot"]) {
      const f = fixture(cardId, side);
      assert.equal(f.ability.definition.source.patternId, "auto-rc-grade-three-clan-discard-named-search-v1");
      assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
      const queued = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(queued.queued.length, 1, `${side}/${cardId}`);
      assert.equal(f.state.pendingAbility.side, side);
      assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
      assert.equal(decide(f, side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid).ok, false, "opponent cannot resolve the private cost");
      const result = decide(f);
      assert.equal(result.ok, true, result.reason);
      assert.equal(f.state.players[side].drop[0].uid, f.discard.uid);
      assert.equal(f.state.players[side].hand.some(item => item.uid === f.target.uid), true);
      assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
      assert.equal(clan, f.ability.costs[0].filter.clan);
      assert.equal(target, f.ability.definition.effects[0].cardName);
    }
  }
});

test("an exact source with no legal Grade 3 clan discard gets no prompt", () => {
  for (const [cardId] of FAMILY) {
    const f = fixture(cardId, "bot", false);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 0, cardId);
    assert.equal(f.state.pendingAbility, null);
  }
});

test("a same-name search ability cannot be forged with a different printed card or cost", () => {
  const f = fixture("cfa-12");
  const forged = { ...f.ability, definition: { ...f.ability.definition, printedText: "AUTO: When this unit is placed on RC, draw a card." } };
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
