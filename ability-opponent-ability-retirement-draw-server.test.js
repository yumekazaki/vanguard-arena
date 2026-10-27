"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => card.id === id);
const makeCard = (cardId, uid, ownerPlayerId, extra = {}) => {
  const def = byId(cardId) || { name: cardId, type: "Unit", grade: 0 };
  return { uid, cardId, cardName: def.name, type: def.type, grade: Number(def.grade || 0), ownerPlayerId, controllerPlayerId: ownerPlayerId, unitCard: true, ...extra };
};

function setup() {
  const retireCard = byId("cfa-1201");
  const retireAbility = Engine.parseCardAbilities(retireCard).find(item => item.id === "cfa-1201:1");
  const targetCard = byId("cfa-12948");
  const targetAbility = Engine.parseCardAbilities(targetCard).find(item => item.id === "cfa-12948:0");
  assert.equal(retireAbility.definition?.source?.patternId, "auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1");
  assert.equal(targetAbility.definition?.source?.patternId, "auto-rc-retired-by-opponent-ability-soul-blast-draw-v1");
  const retireSource = makeCard("cfa-1201", "host-retire-source", "host", { circle: "vanguard" });
  const target = makeCard("cfa-12948", "guest-retired-source", "guest", { circle: "rear-left" });
  const host = { playerId: "host", vanguard: retireSource, rear: [], hand: [], soul: [], damage: [0, 1].map(i => makeCard("damage", `host-cb-${i}`, "host", { faceDown: false })), deck: [], drop: [], bind: [], orders: [], guardCircle: [] };
  const guest = { playerId: "guest", vanguard: makeCard("cfa-3", "guest-vg", "guest", { circle: "vanguard" }), rear: [target, makeCard("cfa-3", "guest-legal-retire-target", "guest", { grade: 2, circle: "rear-right" }), null, null, null], hand: [], soul: [makeCard("soul", "guest-soul-cost", "guest")], damage: [], deck: [makeCard("draw", "guest-draw", "guest")], drop: [], bind: [], orders: [], guardCircle: [] };
  const state = { matchId: "retire-cause", stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], turn: 3, side: "human", phase: 2, players: { human: host, bot: guest } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: "host", turnPlayerId: "host", sourceCardInstanceId: retireSource.uid, sourceOwnerPlayerId: "host", sourceControllerPlayerId: "host", cardInstanceId: retireSource.uid, subjectCardInstanceId: retireSource.uid, subjectOwnerPlayerId: "host", subjectControllerPlayerId: "host", previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "main", timingWindow: "card-placement" });
  Engine.registerAbilityDefinitions([retireAbility.definition, targetAbility.definition]);
  return { state, event, retireAbility, retireSource, targetAbility, target, host, guest };
}

test("four real Rear-Guard abilities require retirement by an opponent skill and draw only after Soul Blast", () => {
  const ids = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== "auto-rc-retired-by-opponent-ability-soul-blast-draw-v1") continue;
    ids.push(card.id);
    assert.equal(ability.trigger.subject, "event-subject");
    assert.equal(ability.trigger.abilitySourceControllerRelation, "opponent");
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }]);
    assert.deepEqual(ability.effects, [{ op: "draw", target: "controller", count: 1 }]);
  }
  assert.deepEqual(ids.sort(), ["cfa-12948", "cfa-13567", "cfa-13617", "cfa-13628"]);
});

test("opponent ability retirement prompts and resolves privately for the retired unit's controller", () => {
  const f = setup();
  const placed = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(placed.queued.length, 1);
  assert.equal(f.state.pendingAbility.side, "human");
  const legalTarget = f.guest.rear[1];
  const retired = Reducer.applyAbilityDecision(f.state, { actorAuthUid: "auth-host", actionId: "host-retire", expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.retireSource.uid, abilityId: f.retireAbility.id, costSelections: { cb: f.host.damage.map(card => card.uid), sb: [], discard: [], reveal: [] }, targetUid: legalTarget.uid } } }, seats, Engine);
  assert.equal(retired.ok, true, retired.reason);
  assert.equal(f.guest.drop.some(card => card.uid === legalTarget.uid), true);
  const cause = retired.events.find(item => item.type === "card.retired" && item.subjectCardInstanceId === legalTarget.uid);
  assert.equal(cause.abilitySourceInstanceId, f.retireSource.uid);
  assert.equal(cause.abilitySourceControllerPlayerId, "host", JSON.stringify(cause));
  f.guest.rear[0] = null; f.guest.drop.push(f.target);
  const targetEvent = Engine.createGameEvent(f.state, { type: "card.retired", actingPlayerId: cause.actingPlayerId, turnPlayerId: cause.turnPlayerId, sourceCardInstanceId: cause.sourceCardInstanceId, sourceControllerPlayerId: cause.sourceControllerPlayerId, abilitySourceInstanceId: cause.abilitySourceInstanceId, abilitySourceControllerPlayerId: cause.abilitySourceControllerPlayerId, cardInstanceId: f.target.uid, subjectCardInstanceId: f.target.uid, subjectControllerPlayerId: "guest", previousLocation: "rear-left", currentLocation: "drop", reason: "ability-effect", phase: "main", timingWindow: "ability-resolution" });
  const followup = Reducer.discoverAutoTriggers(f.state, [targetEvent], Engine);
  assert.equal(followup.queued.length, 1);
  const guestPending = f.state.pendingAbility?.side === "bot" ? f.state.pendingAbility : f.state.pendingAbilities.find(item => item.side === "bot" && item.instance.uid === f.target.uid);
  assert.equal(guestPending?.instance.uid, f.target.uid);
  assert.equal(Engine.eventMatchesAbilityTrigger(guestPending.ability, "retire", targetEvent, f.target.uid, "rear-left", "drop", "guest"), true, JSON.stringify({ trigger: guestPending.ability.trigger, pending: guestPending }));
  const resolved = Reducer.applyAbilityDecision(f.state, { actorAuthUid: "auth-guest", actionId: "guest-retired-trigger", expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.target.uid, abilityId: f.targetAbility.id, costSelections: { cb: [], sb: [f.guest.soul[0].uid], discard: [], reveal: [] } } } }, seats, Engine);
  assert.equal(resolved.ok, true, JSON.stringify({ reason: resolved.reason, field: guestPending.field, sourceLocation: Engine.locateCardInstance(f.state, f.target.uid)?.zone, event: guestPending.eventContext }));
  assert.equal(f.guest.soul.length, 0);
  assert.equal(f.guest.hand.some(card => card.uid === "guest-draw"), true);
  assert.equal(f.host.hand.length, 0);
  assert.ok(guestPending);
});

test("same-controller retirements and battle-hit retirements lack opponent-ability provenance and cannot prompt", () => {
  const f = setup();
  const ownCause = Engine.createGameEvent(f.state, { type: "card.retired", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: "guest-other-unit", sourceControllerPlayerId: "guest", cardInstanceId: f.target.uid, subjectCardInstanceId: f.target.uid, subjectControllerPlayerId: "guest", previousLocation: "rear-left", currentLocation: "drop", reason: "ability-effect", abilitySourceInstanceId: "guest-other-unit", abilitySourceControllerPlayerId: "guest", phase: "main" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [ownCause], Engine).queued.length, 0);
  const battle = Engine.createGameEvent(f.state, { type: "card.retired", actingPlayerId: "host", turnPlayerId: "host", sourceCardInstanceId: f.target.uid, sourceControllerPlayerId: "guest", cardInstanceId: f.target.uid, subjectCardInstanceId: f.target.uid, subjectControllerPlayerId: "guest", previousLocation: "rear-left", currentLocation: "drop", reason: "attack-hit-retire", phase: "battle" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [battle], Engine).queued.length, 0);
  const unknownCause = Engine.createGameEvent(f.state, { type: "card.retired", actingPlayerId: "host", turnPlayerId: "host", sourceCardInstanceId: f.target.uid, cardInstanceId: f.target.uid, subjectCardInstanceId: f.target.uid, subjectControllerPlayerId: "guest", previousLocation: "rear-left", currentLocation: "drop", phase: "main" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [unknownCause], Engine).queued.length, 0);
});
