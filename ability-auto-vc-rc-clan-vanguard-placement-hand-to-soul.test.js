"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-vc-rc-clan-vanguard-placement-hand-to-soul-v1";
const FAMILY = [
  ["cfa-18", "Shadow Paladin"], ["cfa-198", "Gold Paladin"], ["cfa-410", "Oracle Think Tank"], ["cfa-464", "Dark Irregulars"],
  ["cfa-644", "Royal Paladin"], ["cfa-793", "Pale Moon"]
];
const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const clansOf = card => [card?.clan, ...(card?.clans || [])].filter(Boolean).map(value => String(value).toLowerCase());

function fixture(cardId, clan, side = "human", circle = "rear-guard") {
  const card = byId.get(cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(card && ability, `compiled real catalog card ${cardId}`);
  const vanguardDefinition = catalog.find(candidate => candidate.type === "Unit" && clansOf(candidate).includes(clan.toLowerCase()));
  const correctHandDefinition = catalog.find(candidate => candidate.type === "Unit" && clansOf(candidate).includes(clan.toLowerCase()) && candidate.id !== cardId);
  const wrongHandDefinition = catalog.find(candidate => candidate.type === "Unit" && !clansOf(candidate).includes(clan.toLowerCase()));
  assert.ok(vanguardDefinition && correctHandDefinition && wrongHandDefinition, `${clan} fixture definitions`);
  const ownId = side === "human" ? "player-host" : "player-guest", otherId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, type: card.type, grade: Number(card.grade), ownerPlayerId: ownId, controllerPlayerId: ownId };
  const vanguard = { uid: `vg-${side}`, cardId: vanguardDefinition.id, cardName: vanguardDefinition.name, type: vanguardDefinition.type, grade: Number(vanguardDefinition.grade), ownerPlayerId: ownId, controllerPlayerId: ownId };
  const selected = { uid: `hand-match-${side}`, cardId: correctHandDefinition.id, cardName: correctHandDefinition.name, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const wrongClan = { uid: `hand-wrong-${side}`, cardId: wrongHandDefinition.id, cardName: wrongHandDefinition.name, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const foreign = { ...selected, uid: `foreign-${side}`, ownerPlayerId: otherId, controllerPlayerId: otherId };
  const makePlayer = (playerId, vg, rear, hand) => ({ playerId, vanguard: vg, rear, hand, soul: [], deck: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], removed: [] });
  const own = makePlayer(ownId, vanguard, circle === "rear-guard" ? [source, null, null, null, null] : [null, null, null, null, null], [selected, wrongClan]);
  if (circle === "vanguard") own.vanguard = source;
  const otherVanguard = { ...vanguard, uid: `opponent-vg-${side}`, ownerPlayerId: otherId, controllerPlayerId: otherId };
  const other = makePlayer(otherId, otherVanguard, Array(5).fill(null), [foreign]);
  const state = { matchId: `hand-soul-${cardId}-${side}-${circle}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    authoritySeats: { hostSide: "human", guestSide: "bot" }, players: side === "human" ? { human: own, bot: other } : { human: other, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId,
    previousLocation: "hand", currentLocation: circle, circle: circle === "vanguard" ? "vanguard" : "rear-left", phase: "main", timingWindow: "normal-call" });
  return { state, event, ability, source, selected, wrongClan, foreign, side, ownId };
}

function resolve(f, actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, effectUid = f.selected.uid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId: `resolve-${f.state.matchId}-${effectUid || "none"}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid, optionalNoTarget: !effectUid } } }, seats, Engine);
}

test("all six real catalog AUTO definitions preserve the source placement, VC/RC, clan, and up-to-one hand-to-Soul text", () => {
  const audit = auditCatalog(catalog);
  const found = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)).filter(ability => ability.definition?.source?.patternId === PATTERN);
  assert.equal(found.length, FAMILY.length);
  assert.equal(audit.patterns[PATTERN], FAMILY.length);
  for (const [cardId, clan] of FAMILY) {
    const ability = found.find(item => item.id === `${cardId}:0`);
    assert.ok(ability, cardId);
    assert.deepEqual(ability.trigger.circles, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }]);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "move-filtered-hand-card-to-soul", target: "controller", maximum: 1, filter: { clan } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
  assert.equal(audit.invalidCompiled.length, 0);
});

test("the exact placement controller privately chooses a matching-clan hand instance and may choose zero", () => {
  for (const side of ["human", "bot"]) for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId, clan, side), discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}/${cardId}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const forged = resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(forged.ok, false, `${side}/${cardId} rejects proxy resolution`);
    const chosen = resolve(f);
    assert.equal(chosen.ok, true, `${side}/${cardId}: ${chosen.reason}`);
    assert.equal(f.state.players[side].soul.at(-1).uid, f.selected.uid);
    assert.equal(f.state.players[side].hand.some(card => card.uid === f.selected.uid), false);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.some(card => card.uid === f.foreign.uid), true);

    const noChoice = fixture(cardId, clan, side), noChoiceDiscovery = Reducer.discoverAutoTriggers(noChoice.state, [noChoice.event], Engine);
    assert.equal(noChoiceDiscovery.queued.length, 1);
    const declinedChoice = resolve(noChoice, undefined, null);
    assert.equal(declinedChoice.ok, true, `${side}/${cardId} may choose up to zero: ${declinedChoice.reason}`);
    assert.equal(noChoice.state.players[side].soul.length, 0);
    assert.equal(noChoice.state.players[side].hand.length, 2);
  }
});

test("wrong placement circle, wrong Vanguard clan, foreign or wrong-clan hand targets, and duplicate event are rejected", () => {
  const [cardId, clan] = FAMILY[0];
  const onGuardian = fixture(cardId, clan, "human", "guardian");
  assert.equal(Reducer.discoverAutoTriggers(onGuardian.state, [onGuardian.event], Engine).queued.length, 0);
  const wrongVanguard = fixture(cardId, clan);
  wrongVanguard.state.players.human.vanguard = { ...wrongVanguard.state.players.human.vanguard, cardId: "unknown-vanguard", cardName: "Wrong Clan" };
  assert.equal(Reducer.discoverAutoTriggers(wrongVanguard.state, [wrongVanguard.event], Engine).queued.length, 0);
  const f = fixture(cardId, clan), queued = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(queued.queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  for (const target of [f.wrongClan.uid, f.foreign.uid, "missing-card"]) {
    const bad = resolve(f, undefined, target);
    assert.equal(bad.ok, false, `reject selection ${target}`);
    assert.equal(f.state.players.human.hand.some(card => card.uid === f.selected.uid), true);
    assert.equal(f.state.players.human.soul.length, 0);
  }
});
