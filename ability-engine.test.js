const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const curatedDefinitions = require("./ability-definitions.js");
const { createCardInstance, canActivateManualAbility, abilityUsageKey, parseCardAbilities, createGameEvent, claimGameEvent, eventSubjectMatches, isManuallyActivatable, eventMatchesAbilityTrigger, canPayAbilityCosts, evaluateAbilityConditions, validateRemoteRequest, validateAbilityDecision, claimRemoteRequest, registerAbilityDefinitions, validateEffectProgram, resolveEffectProgram, EFFECT_HANDLERS } = require("./ability-engine.js");
registerAbilityDefinitions(curatedDefinitions);
test("creates distinct card copies with owner and initial controller identity", () => {
  const first = createCardInstance("card-1", "player-a", "copy-a");
  const second = createCardInstance("card-1", "player-a", "copy-b");
  assert.equal(first.uid, "copy-a");
  assert.equal(first.ownerPlayerId, "player-a");
  assert.equal(first.controllerPlayerId, "player-a");
  assert.notEqual(first.uid, second.uid);
  assert.throws(() => createCardInstance("card-1", null), /owner player ID/);
});
test("player setup creates its identity before stamping deck instances", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const playerSetup = source.match(/function makePlayer\(deck, name, human = false\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(playerSetup, /const playerId\s*=\s*crypto\.randomUUID/);
  assert.match(playerSetup, /cardInstances\(deck, playerId\)/);
  assert.match(playerSetup, /return \{ playerId,/);
});

test("once-per-turn usage is scoped to exact card instance and ability", () => {
  const firstCopy = abilityUsageKey(7, "player-a", "copy-a", "card:0");
  const secondCopy = abilityUsageKey(7, "player-a", "copy-b", "card:0");
  const secondAbility = abilityUsageKey(7, "player-a", "copy-a", "card:1");
  assert.notEqual(firstCopy, secondCopy);
  assert.notEqual(firstCopy, secondAbility);
  assert.equal(firstCopy, abilityUsageKey(7, "player-a", "copy-a", "card:0"));
});

test("manual activation legality requires the controller, Main timing, legal zone, costs, conditions, and unused restriction", () => {
  const ability = parseCardAbilities({ id: "manual-legal", text: "ACT (RC) 1/Turn: COST [CB1] Draw a card." })[0];
  const context = { cardInstanceId: "copy-a", controllerPlayerId: "player-a", actorPlayerId: "player-a", turnPlayerId: "player-a", phase: "main", inPermittedZone: true, alreadyUsed: false, resources: { faceUpDamage: 1 } };
  assert.deepEqual(canActivateManualAbility(ability, context), { ok: true });
  assert.equal(canActivateManualAbility(ability, { ...context, actorPlayerId: "player-b" }).reason, "not-controller");
  assert.equal(canActivateManualAbility(ability, { ...context, phase: "battle" }).reason, "wrong-timing-window");
  assert.equal(canActivateManualAbility(ability, { ...context, inPermittedZone: false }).reason, "wrong-zone");
  assert.equal(canActivateManualAbility(ability, { ...context, alreadyUsed: true }).reason, "usage-restriction");
  assert.equal(canActivateManualAbility(ability, { ...context, resources: { faceUpDamage: 0 } }).reason, "unpayable-cost");
  assert.equal(canActivateManualAbility(ability, { ...context, resolutionBlocked: true }).reason, "resolution-in-progress");
});

test("splits a card's printed AUTO, ACT, and CONT abilities independently", () => {
  const abilities = parseCardAbilities({
    id: "test-card",
    text: "[AUTO](RC): When this unit attacks, draw a card.\n[ACT](VC) 1/Turn: COST [CB1] Draw a card.\n[CONT](VC): This unit gets +5000 power."
  });
  assert.deepEqual(abilities.map(({ kind }) => kind), ["AUTO", "ACT", "CONT"]);
  assert.deepEqual(abilities.map(({ id }) => id), ["test-card:0", "test-card:1", "test-card:2"]);
  assert.match(abilities[0].raw, /When this unit attacks, draw a card\./);
  assert.match(abilities[0].printedText, /\[AUTO\]/);
  assert.equal(abilities[1].once, true);
  assert.equal(abilities[1].gb, 0);
  assert.match(abilities[2].raw, /This unit gets \+5000 power\./);
});

test("preserves Generation Break and once-per-turn markers", () => {
  const card = { id: "gb-card", text: "AUTO: GB3 When placed, draw one card.\nACT: Once per turn, Soul-Blast 1." };
  const abilities = parseCardAbilities(card);
  assert.equal(abilities[0].gb, 3);
  assert.equal(abilities[1].once, true);
  assert.equal(abilities[0].cardId, "gb-card");
  assert.equal(abilities[0].implementationStatus, "needs-review");
  assert.deepEqual(parseCardAbilities({ id: "plain-card", text: "Flavor text only." }), []);
});
test("creates structured, serializable events with explicit instance identities and deduplicates IDs", () => {
  const match = { matchId: "match-7", eventSequence: 0 };
  const first = createGameEvent(match, {
    type: "unit.attacked", actingPlayerId: "joiner", turnPlayerId: "joiner",
    sourceCardInstanceId: "copy-a", sourceOwnerPlayerId: "p1", sourceControllerPlayerId: "p1",
    subjectCardInstanceId: "copy-a", subjectOwnerPlayerId: "p1", subjectControllerPlayerId: "p1",
    targetCardInstanceIds: ["opponent-vanguard"], currentLocation: "rear-left",
    circle: "rear-left", phase: 5, timingWindow: "attack-declared"
  });
  const second = createGameEvent(match, { type: "unit.attacked", actingPlayerId: "joiner" });

  assert.equal(first.eventId, "match-7:1");
  assert.equal(first.sourceCardInstanceId, "copy-a");
  assert.equal(first.sourceOwnerPlayerId, "p1");
  assert.equal(first.subjectControllerPlayerId, "p1");
  assert.equal(first.targetCardInstanceIds[0], "opponent-vanguard");
  assert.equal(second.eventId, "match-7:2");
  assert.equal(claimGameEvent(match, first.eventId), true);
  assert.equal(claimGameEvent(match, first.eventId), false);
});

test("matches ability subjects to exact source, event, booster, or boosted-unit instance IDs", () => {
  const event = createGameEvent({ matchId: "m" }, {
    eventId: "m:b1", type: "unit.boosted", actingPlayerId: "p1",
    sourceCardInstanceId: "booster-copy", subjectCardInstanceId: "booster-copy",
    boosterCardInstanceId: "booster-copy", boostedCardInstanceId: "attacker-copy"
  });
  assert.equal(eventSubjectMatches(event, "booster-copy", "source"), true);
  assert.equal(eventSubjectMatches(event, "attacker-copy", "boosted-unit"), true);
  assert.equal(eventSubjectMatches(event, "booster-copy", "event-subject"), true);
  assert.equal(eventSubjectMatches(event, "same-name-other-copy", "source"), false);
  assert.equal(eventSubjectMatches(event, "same-name-other-copy", "booster"), false);
});
test("compiles exact attack, boost, and circle-specific placement triggers", () => {
  const card = { id: "real-example", text: "[AUTO](RC): When this unit attacks, if you have an Ancient Dragon vanguard, this unit gets +3000 power.\n[AUTO](VC): When this unit is placed on VC or RC, draw a card.\n[AUTO](RC): When this unit boosts, draw a card." };
  const [attack, placed, boost] = parseCardAbilities(card);
  assert.equal(attack.trigger.eventType, "unit.attacked");
  assert.equal(attack.trigger.subject, "source");
  assert.deepEqual(attack.requiredLocation, ["rear-guard"]);
  assert.equal(attack.conditionStatus, "needs-review");
  assert.equal(placed.trigger.eventType, "card.placed");
  assert.deepEqual(placed.trigger.circles, ["vanguard", "rear-guard"]);
  assert.deepEqual(placed.requiredLocation, ["vanguard"]);
  assert.equal(boost.trigger.eventType, "unit.boosted");
  assert.equal(boost.trigger.subject, "source");
});

test("recognizes ride-over triggers by the ridden card instance and flags unknown AUTO text", () => {
  const [forerunner, unknown] = parseCardAbilities({ id: "ride-examples", text: "[AUTO](RC): When another unit is placed on (VC) by riding this unit, you may call this card to (RC).\n[AUTO](RC): When this unit is retired, draw a card." });
  assert.equal(forerunner.trigger.eventType, "card.ridden");
  assert.equal(forerunner.trigger.subject, "event-subject");
  assert.equal(forerunner.implementationStatus, "trigger-definition-pending-validation");
  assert.equal(unknown.trigger.status, "needs-review");
  assert.equal(unknown.implementationStatus, "needs-review");
});

test("only printed ACT abilities may be manually activated", () => {
  assert.equal(isManuallyActivatable({ kind: "ACT" }), true);
  assert.equal(isManuallyActivatable({ kind: "AUTO", once: true }), false);
  assert.equal(isManuallyActivatable({ kind: "CONT", once: true }), false);
  assert.equal(isManuallyActivatable(null), false);
});
test("models Battle Sister, Cocoa clan condition while keeping it subject to validation", () => {
  const cocoa = parseCardAbilities({
    id: "cfa-2",
    text: "AUTO: When this unit is placed on VC or RC, if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck."
  })[0];
  assert.equal(cocoa.trigger.eventType, "card.placed");
  assert.deepEqual(cocoa.trigger.circles, ["vanguard", "rear-guard"]);
  assert.equal(cocoa.conditionStatus, "modeled");
  assert.deepEqual(cocoa.conditions, [{ type: "controller-vanguard-has-clan", value: "Oracle Think Tank" }]);
  assert.equal(evaluateAbilityConditions(cocoa, { vanguardClans: ["Oracle Think Tank"] }), true);
  assert.equal(evaluateAbilityConditions(cocoa, { vanguardClans: ["Shadow Paladin"] }), false);
  assert.equal(cocoa.implementationStatus, "trigger-definition-pending-validation");
});
test("requires the exact source instance, declared event, and legal circle before an AUTO is eligible", () => {
  const attack = parseCardAbilities({ id: "attacker-skill", text: "[AUTO](RC): When this unit attacks, draw a card." })[0];
  const event = createGameEvent({ matchId: "m" }, { eventId: "m:a1", type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "copy-1", subjectCardInstanceId: "copy-1" });
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-1", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-2", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(attack, "place", event, "copy-1", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-1", "vanguard", "vanguard"), false);
});

test("rejects a recognized trigger until an unparsed mandatory condition is modeled", () => {
  const ability = parseCardAbilities({ id: "conditional", text: "AUTO: When this unit is placed on VC or RC, if you have an Oracle Think Tank vanguard, draw a card." })[0];
  const event = createGameEvent({ matchId: "m" }, { eventId: "m:p1", type: "card.placed", actingPlayerId: "p1", sourceCardInstanceId: "copy-1", subjectCardInstanceId: "copy-1" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "copy-1", "rear-left", "rear-left"), false);
});
test("supports the two real Megacolony Battler C AUTO windows with exact ride and booster identities", () => {
  const abilities = parseCardAbilities({
    id: "cfa-megacolony-battler-c",
    text: "AUTO: Forerunner (When another unit from the same clan rides this unit, you may call this card to RC.)\nAUTO [RC]: [Counter Blast 1 & Put this unit into your soul] When an attack hits during the battle that this unit boosted, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and that unit cannot stand during your opponent’s next stand phase."
  });
  const ride = abilities[0], hit = abilities[1];
  const rideEvent = createGameEvent({ matchId: "m" }, { eventId: "m:r1", type: "card.ridden", actingPlayerId: "p1", sourceCardInstanceId: "rider", subjectCardInstanceId: "starter" });
  const hitEvent = createGameEvent({ matchId: "m" }, { eventId: "m:h1", type: "attack.hit", actingPlayerId: "p1", sourceCardInstanceId: "attacker", subjectCardInstanceId: "attacker", boosterCardInstanceId: "booster" });
  assert.equal(ride.trigger.eventType, "card.ridden");
  assert.equal(eventMatchesAbilityTrigger(ride, "ride", rideEvent, "starter", "soul", "vanguard"), true);
  assert.equal(hit.trigger.eventType, "attack.hit");
  assert.deepEqual(hit.requiredLocation, ["rear-guard"]);
  assert.equal(hit.costStatus, "needs-review");
  assert.equal(eventMatchesAbilityTrigger(hit, "hit", hitEvent, "booster", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(hit, "hit", hitEvent, "different-copy", "rear-left", "rear-left"), false);
});
test("matches a cost-free boosted-attack hit trigger only to that battle's booster", () => {
  const ability=parseCardAbilities({id:"booster-hit",text:"[AUTO](RC): When an attack hits during the battle that this unit boosted, draw a card."})[0];
  const event=createGameEvent({matchId:"m"},{eventId:"m:h2",type:"attack.hit",actingPlayerId:"p1",sourceCardInstanceId:"attacker",boosterCardInstanceId:"booster"});
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"booster","rear-left","rear-left"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"other-booster","rear-left","rear-left"),false);
});

test("application routes AUTO eligibility through the exact-instance engine matcher", () => {
  const source = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const declarations = [...source.matchAll(/function abilityTriggerMatches\(/g)];
  assert.equal(declarations.length, 1);
  assert.match(declarations[0][0] + source.slice(declarations[0].index, declarations[0].index + 240), /eventMatchesAbilityTrigger/);
  assert.match(source, /cb=abilityCostCount\(x\.ability,"counter-blast"\)/);
  assert.match(source, /cost=\{cb:abilityCostCount\(x\.ability,"counter-blast"\)/);
  assert.match(source, /targetZone:zone,boostUid:setup\.boostUid/);
  assert.match(source, /evaluateAbilityConditions\(a,/);
  assert.match(source, /validateRemoteRequest\(match,message\)/);
  assert.match(source, /claimRemoteRequest\(match,message\.actionId\)/);
  assert.match(source, /expectedStateVersion/);
  assert.match(source, /resolveReviewedAbility\(x,x\.ability\.definition\)/);
  assert.match(source, /resolveEffectProgram\(definition\.effects/);
  assert.equal([...source.matchAll(/connection\.send\(\{\s*type:\s*"action"/g)].length, 0);
});

test("parses common explicit AUTO costs into structured requirements and checks affordability", () => {
  const ability = parseCardAbilities({ id: "costed-attack", text: "[AUTO](RC): COST [CB1 & SB1 & discard a card from your hand & rest this unit] When this unit attacks, draw a card." })[0];
  assert.equal(ability.costStatus, "supported-cost");
  const event = createGameEvent({ matchId: "m" }, { type: "unit.attacked", actingPlayerId: "p", sourceCardInstanceId: "source" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "source", "rear-left", "rear-left"), true);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }, { type: "soul-blast", count: 1 }, { type: "discard", count: 1 }, { type: "rest-source", count: 1 }]);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, soulCount: 1, discardableHand: 1, sourceRested: false }), true);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, soulCount: 1, discardableHand: 1, sourceRested: true }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 0, soulCount: 1, discardableHand: 1, sourceRested: false }), false);
});

test("keeps unmodeled self-to-soul costs unavailable", () => {
  const ability = parseCardAbilities({ id: "unsupported-cost", text: "[AUTO](RC): COST [CB1 & put this unit into your soul] When an attack hits, draw a card." })[0];
  assert.equal(ability.costStatus, "needs-review");
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1 }), false);
});

test("parses a real Blaster Dark AUTO cost and requires its printed Vanguard placement", () => {
  const ability = parseCardAbilities({ id: "cfa-20", text: "AUTO: [Counter Blast 2] When this unit is placed on VC, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and retire it." })[0];
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.deepEqual(ability.trigger.circles, ["vanguard"]);
  assert.equal(ability.costStatus, "supported-cost");
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2 }]);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 2 }), true);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1 }), false);
});

test("evaluates modeled field, boost, and attack-target conditions from exact state", () => {
  const [emptyField, boosted, target] = parseCardAbilities({ id: "conditions", text: "AUTO: When this unit attacks, if you have no rear-guards, draw a card.\nAUTO: When this unit attacks, if this unit was boosted, draw a card.\nAUTO: When this unit attacks, if this unit attacks a vanguard, draw a card." });
  assert.equal(evaluateAbilityConditions(emptyField, { controllerRearGuards: 0 }), true);
  assert.equal(evaluateAbilityConditions(emptyField, { controllerRearGuards: 1 }), false);
  assert.equal(evaluateAbilityConditions(boosted, { sourceInstanceId: "attacker", eventSubjectInstanceId: "attacker", boosterInstanceId: "booster" }), true);
  assert.equal(evaluateAbilityConditions(boosted, { sourceInstanceId: "attacker", eventSubjectInstanceId: "other", boosterInstanceId: "booster" }), false);
  assert.equal(evaluateAbilityConditions(target, { eventTargetLocation: "vanguard" }), true);
  assert.equal(evaluateAbilityConditions(target, { eventTargetLocation: "rear-guard" }), false);
});

test("remote requests require a fresh ID and the current state version", () => {
  const state = { stateVersion: 4, processedActionIds: [] };
  const request = { actionId: "guest-action-1", expectedStateVersion: 4 };
  assert.deepEqual(validateRemoteRequest(state, request), { ok: true });
  assert.equal(claimRemoteRequest(state, request.actionId), true);
  assert.equal(claimRemoteRequest(state, request.actionId), false);
  assert.deepEqual(validateRemoteRequest(state, request), { ok: false, reason: "duplicate-action" });
  assert.deepEqual(validateRemoteRequest(state, { actionId: "guest-action-2", expectedStateVersion: 3 }), { ok: false, reason: "stale-state-version", expected: 3, current: 4 });
  assert.equal(validateRemoteRequest(state, { expectedStateVersion: 4 }).reason, "missing-action-id");
});

test("ability decisions validate match, joining-player identity, and exact controlled source", () => {
  const state = { matchId: "room-1", stateVersion: 3, processedActionIds: [] };
  const pending = { side: "bot", instance: { uid: "joiner-card", controllerPlayerId: "joiner" }, ability: { id: "card:0" } };
  const request = { matchId: "room-1", actorPlayerId: "joiner", actionId: "decision-1", expectedStateVersion: 3, selection: { instanceUid: "joiner-card", abilityId: "card:0" } };
  assert.deepEqual(validateAbilityDecision(state, request, "joiner", pending), { ok: true });
  assert.equal(validateAbilityDecision(state, { ...request, matchId: "other-room" }, "joiner", pending).reason, "wrong-match");
  assert.equal(validateAbilityDecision(state, { ...request, actorPlayerId: "host" }, "joiner", pending).reason, "wrong-actor");
  assert.equal(validateAbilityDecision(state, { ...request, selection: { ...request.selection, instanceUid: "host-card" } }, "joiner", pending).reason, "wrong-ability");
  assert.equal(validateAbilityDecision(state, { ...request, actorPlayerId: "joiner" }, "joiner", { ...pending, instance: { ...pending.instance, controllerPlayerId: "host" } }).reason, "source-not-controlled");
});

test("binds a reviewed real Key Anchor, Dabid ability to its original text and typed power effect", () => {
  const ability = parseCardAbilities({ id: "cfa-103", text: "Aqua Force/Aquaroid\n\nAUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.definition.source.snapshotDate, "2025-05-09");
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
});

test("validates every effect step before applying the ordered program", () => {
  const effects = [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }, { op: "draw", count: 1 }];
  const applied = [];
  const handlers = {
    "modify-power": { validate: () => true, apply: () => { applied.push("power"); } },
    draw: { validate: () => false, apply: () => { applied.push("draw"); } }
  };
  assert.deepEqual(validateEffectProgram(effects, handlers), { ok: false, reason: "invalid-effect", index: 1 });
  assert.equal(resolveEffectProgram(effects, handlers).ok, false);
  assert.deepEqual(applied, []);
  handlers.draw.validate = () => true;
  assert.deepEqual(resolveEffectProgram(effects, handlers), { ok: true, applied: 2, results: [undefined, undefined] });
  assert.deepEqual(applied, ["power", "draw"]);
});

test("resolves the reviewed source power effect and updates the current battle power", () => {
  const ability = parseCardAbilities({ id: "cfa-103", text: "Aqua Force/Aquaroid\n\nAUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn." })[0];
  const source = { uid: "key-anchor", turnPowerBoost: 0 };
  const match = { pendingAttack: { attackerUid: source.uid, power: 10000 } };
  const context = { source, sourceInPlay: true, side: "p1", match };
  const result = resolveEffectProgram(ability.effects, EFFECT_HANDLERS, context);
  assert.equal(result.ok, true);
  assert.equal(source.turnPowerBoost, 3000);
  assert.equal(source.turnPowerExpiry, "p1");
  assert.equal(match.pendingAttack.power, 13000);
  const rejected = resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, sourceInPlay: false });
  assert.equal(rejected.ok, false);
  assert.equal(source.turnPowerBoost, 3000);
});
