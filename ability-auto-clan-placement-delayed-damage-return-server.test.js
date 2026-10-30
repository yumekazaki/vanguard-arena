"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-vc-rc-clan-placement-delayed-damage-return-v1";
const CARD_IDS = ["cfa-187","cfa-208","cfa-279","cfa-295","cfa-458","cfa-466","cfa-712","cfa-719","cfa-749","cfa-762","cfa-798","cfa-816","cfa-841","cfa-858","cfa-938","cfa-943","cfa-959","cfa-965","cfa-978","cfa-980","cfa-995","cfa-999","cfa-1057","cfa-1332","cfa-1333","cfa-1378","cfa-1379","cfa-1383","cfa-1384","cfa-1445","cfa-1570","cfa-1722","cfa-1723","cfa-1891","cfa-1892","cfa-1903"];
const NEW_CARD_IDS = ["cfa-1722","cfa-1723","cfa-1891","cfa-1892","cfa-1903"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === String(id));
const abilityFor = id => Engine.parseCardAbilitiesCached(byId(id)).find(ability => ability.definition?.source?.patternId === PATTERN);
const blankPlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });

function fixture({ cardId = CARD_IDS[0], side = "bot", zone = "rear-guard", matchingClan = true, faceUpCost = true } = {}) {
  const card = byId(cardId), ability = abilityFor(cardId), ownerId = side === "human" ? "player-host" : "player-guest";
  assert.ok(card, `catalog card ${cardId}`); assert.ok(ability, `compiled ability ${cardId}:0`);
  const opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "player-guest" : "player-host";
  const own = blankPlayer(ownerId), opponent = blankPlayer(opponentId);
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, type: card.type, grade: Number(card.grade), clan: card.clan,
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true };
  const vanguard = { uid: `vg-${side}`, cardId: "vanguard-test", cardName: "Clan Vanguard", type: "Unit", grade: 3,
    clan: matchingClan ? card.clan : "Different Clan", ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true };
  own.vanguard = zone === "vanguard" ? source : vanguard;
  if (zone === "rear-guard") own.rear[0] = source;
  own.damage = [{ uid: `cb-${side}`, cardId: "cost-card", faceDown: !faceUpCost, ownerPlayerId: ownerId, controllerPlayerId: ownerId },
    { uid: `old-damage-${side}`, cardId: "old-damage", faceDown: true, ownerPlayerId: ownerId, controllerPlayerId: ownerId }];
  const top = { uid: `top-${side}`, cardId: "top-card", ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const otherDamage = { uid: `other-damage-${side}`, cardId: "other-card", ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  own.deck.push(top); opponent.vanguard = { uid: `opp-vg-${side}`, cardId: "opp-vg", ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: `delayed-damage-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, scheduledEffects: [], players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: zone === "vanguard" ? "vanguard" : "rear-left",
    circle: zone === "vanguard" ? "vanguard" : "rear-guard", phase: "main", timingWindow: "normal-call" });
  return { state, event, ability, card, source, top, otherDamage, own, opponent, side, ownerId, opponentId, opponentSide };
}

function authFor(side) { return side === "human" ? seats.hostAuthUid : seats.guestAuthUid; }
function decide(f, { accept = true, actor = authFor(f.side), effectUid = null, actionId = `${f.state.matchId}-ability` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId, matchId: f.state.matchId, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.state.pendingAbility?.ability.id || f.ability.id,
      costSelections: { cb: accept ? [`cb-${f.side}`] : [], sb: [], discard: [], reveal: [] }, effectUid } }
  }, seats, Engine);
}

test("all 36 clan-gated placement abilities use one reviewed delayed-damage handler", () => {
  assert.equal(new Set(CARD_IDS).size, CARD_IDS.length, "the reviewed batch has no duplicate card IDs");
  const definitions = CARD_IDS.map(cardId => abilityFor(cardId)?.definition).filter(definition => definition?.source?.patternId === PATTERN);
  assert.equal(definitions.length, CARD_IDS.length);
  for (const cardId of CARD_IDS) {
    const card = byId(cardId);
    const parsedAbilities = Engine.parseCardAbilitiesCached(card);
    const ability = abilityFor(cardId);
    assert.ok(ability, cardId);
    assert.equal(parsedAbilities.length, 1, `${cardId} has no other unreviewed printed abilities`);
    assert.equal(card.type, "Unit", `${cardId} is a unit card`);
    assert.ok(Number.isFinite(Number(card.grade)), `${cardId} has grade metadata`);
    assert.ok(Number.isFinite(Number(card.power)), `${cardId} has power metadata`);
    assert.ok(Number.isFinite(Number(card.shield)), `${cardId} has shield metadata`);
    assert.ok(card.text.includes(ability.printedText), `${cardId} compiled text is preserved in the catalog text`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.printedText, ability.definition.printedText);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: card.clan }], `${cardId} checks its printed clan`);
    assert.deepEqual(ability.trigger, {
      status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["vanguard", "rear-guard"],
      sameSourceCircle: false, excludeSourceAsSubject: false, sourceLocation: null
    }, `${cardId} triggers only when this exact card is placed on VC or RC`);
    assert.deepEqual(ability.definition.effects, [
      { op: "deck-to-damage", target: "controller", count: 1 },
      { op: "schedule-damage-return-at-turn-end", target: "controller", due: "end-phase-start" }
    ], `${cardId} preserves effect order and end-phase timing`);
    assert.equal(ability.once, false, `${cardId} has no once-per-turn restriction`);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.choiceStatus, "modeled");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === ability.id);
    assert.ok(trusted, `${cardId} has a production-reviewed definition`);
    assert.equal(trusted.printedText, ability.printedText);
    assert.deepEqual(trusted.effects, ability.definition.effects);
  }
});

test("the exact placed source prompts only its controller on either circle and either seat", () => {
  for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-guard"]) {
    const f = fixture({ side, zone });
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${side}/${zone}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const forged = decide(f, { actor: authFor(f.opponentSide), actionId: `forged-${side}-${zone}` });
    assert.equal(forged.ok, false);
  }
});

test("all 36 card definitions enforce their own clan, cost, and controller for both seats", () => {
  for (const cardId of CARD_IDS) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const paid = decide(f, { actionId: `paid-${cardId}-${side}` });
    assert.equal(paid.ok, true, paid.reason);
    assert.equal(f.own.damage.some(card => card.uid === f.top.uid && card.faceDown === false), true);
    assert.equal(f.state.scheduledEffects.length, 1);
    assert.equal(f.state.scheduledEffects[0].sourceCardInstanceId, f.source.uid);
    const wrongClan = fixture({ cardId, side, matchingClan: false });
    assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0, `${cardId}/${side}/wrong-clan`);
  }
});

test("wrong clan, unrelated source, wrong circle, and unavailable Counter-Blast do not queue", () => {
  const wrongClan = fixture({ matchingClan: false });
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
  const noCost = fixture({ faceUpCost: false });
  const skipped = Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine);
  assert.equal(skipped.queued.length, 0);
  assert.equal(skipped.skipped.some(item => item.reason === "unpayable-cost"), true);
  const wrongSource = fixture();
  const unrelated = Engine.createGameEvent(wrongSource.state, { ...wrongSource.event, eventId: "unrelated-source-placement",
    sourceCardInstanceId: "other-instance", subjectCardInstanceId: "other-instance" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelated], Engine).queued.length, 0);
  const wrongCircle = fixture();
  const guardian = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "guardian-placement",
    currentLocation: "guardian", circle: "guardian" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [guardian], Engine).queued.length, 0);
});

test("declining leaves no schedule; paying moves deck top to Damage and schedules only that turn", () => {
  const declined = fixture();
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  const declineResult = decide(declined, { accept: false });
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.state.scheduledEffects.length, 0);
  assert.ok(declined.own.damage.every(card => card.uid !== declined.top.uid));

  const paid = fixture();
  assert.equal(Reducer.discoverAutoTriggers(paid.state, [paid.event], Engine).queued.length, 1);
  const resolved = decide(paid);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(paid.own.damage.some(card => card.uid === paid.top.uid && card.faceDown === false), true);
  assert.equal(paid.own.deck.length, 0);
  assert.equal(paid.state.scheduledEffects.length, 1);
  assert.equal(paid.state.scheduledEffects[0].turn, paid.state.turn);
  assert.equal(paid.state.scheduledEffects[0].controllerPlayerId, paid.ownerId);
  assert.equal(paid.state.scheduledEffects[0].sourceCardInstanceId, paid.source.uid);
});

test("End Phase privately returns the controller's chosen Damage card even after its source leaves play", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ side });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(decide(f).ok, true);
    f.own.rear[0] = null; f.own.drop.push(f.source);
    f.own.damage.push(f.otherDamage);
    f.state.phase = 5;
    const advanced = Reducer.applyGameAction(f.state, { actorAuthUid: authFor(side), actionId: `end-phase-${side}`,
      expectedStateVersion: f.state.stateVersion, payload: { action: "advance" } }, seats, Engine);
    assert.equal(advanced.ok, true, advanced.reason);
    assert.equal(f.state.phase, 6);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.scheduledEffectId, f.state.scheduledEffects[0].id);
    const forged = Reducer.applyAbilityDecision(f.state, { actorAuthUid: authFor(f.opponentSide), actionId: `forged-end-${side}`,
      matchId: f.state.matchId, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.state.pendingAbility.ability.id, effectUid: f.otherDamage.uid } } }, seats, Engine);
    assert.equal(forged.ok, false);
    const chosen = Reducer.applyAbilityDecision(f.state, { actorAuthUid: authFor(side), actionId: `resolve-end-${side}`,
      matchId: f.state.matchId, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.state.pendingAbility.ability.id, effectUid: f.otherDamage.uid } } }, seats, Engine);
    assert.equal(chosen.ok, true, chosen.reason);
    assert.equal(f.own.damage.some(card => card.uid === f.otherDamage.uid), false);
    assert.equal(f.own.deck.some(card => card.uid === f.otherDamage.uid), true);
    assert.equal(f.own.damage.some(card => card.uid === f.top.uid), true, "the delayed effect can choose any Damage card");
    assert.equal(f.state.scheduledEffects.length, 0);
    assert.equal(f.state.pendingAbility, null);
  }
});
