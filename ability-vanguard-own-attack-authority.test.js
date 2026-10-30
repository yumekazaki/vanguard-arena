"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-vanguard-power-battle-v1";
const ANY_TARGET_PATTERN = "auto-own-attack-power-battle-v1";
const CLAN_PATTERN = "auto-own-attack-vanguard-clan-power-battle-v1";
const GB_PATTERN = "auto-generation-break-own-vanguard-attack-power-battle-v1";
const ADVANTAGE_PATTERN = "auto-own-attack-rear-guard-advantage-power-battle-v1";
const catalog = loadCatalog();
const reviewed = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ({ card, ability })));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function cardDefinition(cardId) { return catalog.find(card => String(card.id) === String(cardId)); }

function fixture({ side = "bot", cardId, targetLocation = "vanguard", attackSource = "source", pattern = PATTERN, abilityId = null, vanguardClan = null } = {}) {
  const definition = cardDefinition(cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => abilityId ? item.id === abilityId : item.definition?.source?.patternId === pattern);
  assert.ok(ability, `reviewed own-attack ability for ${cardId}`);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const opponentId = otherSide === "human" ? "host-player" : "guest-player";
  const source = { uid: "attacker-source", cardId, cardName: definition.name, type: definition.type,
    ownerPlayerId: ownerId, controllerPlayerId: ownerId, clan: vanguardClan || ability.conditions?.[0]?.value || definition.clan,
    power: Number(definition.power || 10000), unitCard: true };
  const own = { playerId: ownerId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gZone: ability.gb ? [{ uid: `g-unit-${side}-${cardId}`, cardId: "cfa-2454", gDeckCard: true, faceUp: true, ownerPlayerId: ownerId, controllerPlayerId: ownerId }] : [] };
  const opponent = { playerId: opponentId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [] };
  const sourceAtVanguard = ability.requiredLocation.includes("vanguard");
  if (sourceAtVanguard) own.vanguard = source;
  else { own.vanguard = { uid: "own-vanguard", cardId: "test-own-vanguard", ownerPlayerId: ownerId, controllerPlayerId: ownerId,
    clan: vanguardClan || ability.conditions?.[0]?.value || definition.clan, grade: 3, unitCard: true }; own.rear[0] = source; }
  opponent.vanguard = { uid: "opponent-vanguard", cardId: "cfa-3", ownerPlayerId: opponentId, controllerPlayerId: opponentId, grade: 3, unitCard: true };
  if (targetLocation !== "vanguard") opponent.rear[0] = { uid: "opponent-rear", cardId: "cfa-4", ownerPlayerId: opponentId, controllerPlayerId: opponentId, grade: 2, unitCard: true };
  const target = targetLocation === "vanguard" ? opponent.vanguard : opponent.rear[0];
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const battleId = `own-attack-${side}-${cardId}`;
  const state = { matchId: "vanguard-own-attack-authority", stateVersion: 3, eventSequence: 0,
    processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    turn: 2, side, phase: 5, players,
    pendingAttack: { battleId, attackerSide: side, attackerUid: source.uid,
      attackerZone: sourceAtVanguard ? "vanguard" : "rear-left", defenderSide: otherSide,
      targetUid: target.uid, targetZone: targetLocation, power: 10000, targetPower: 13000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attackSource === "source" ? source.uid : "different-attacker",
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: attackSource === "source" ? source.uid : "different-attacker",
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [attackSource === "source" ? source.uid : "different-attacker"],
    targetCardInstanceIds: [target.uid], targetLocation, battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, side, ownerId, ability, source, event, amount: ability.definition.effects[0].amount };
}

function resolve(f, auth = f.side === "human" ? "auth-host" : "auth-guest") {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth,
    actionId: `resolve-${f.side}-${pending?.ability?.id || f.ability.id}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all 69 exact own-Vanguard-attack power definitions are trusted with their printed circle, target, and amount", () => {
  assert.equal(reviewed.length, 69);
  for (const id of ["cfa-11776:1", "cfa-11777:1", "cfa-3406:0"]) {
    const ability = reviewed.find(item => item.ability.id === id)?.ability;
    assert.ok(ability, `${id} pronoun-form definition is included`);
    assert.match(ability.printedText, /, it gets power \+2000 until end of that battle\.$/);
  }
  for (const { card, ability } of reviewed) {
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(card.id).find(item => item.id === ability.id);
    assert.ok(trusted, `${ability.id} is registered with the trusted engine`);
    assert.equal(ability.kind, "AUTO", ability.id);
    assert.equal(ability.trigger.eventType, "unit.attacked", ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.equal(ability.trigger.targetLocation, /attacks? a vanguard/i.test(ability.printedText) ? "vanguard" : null, ability.id);
    assert.deepEqual(ability.requiredLocation, ability.printedText.includes("[RC]") ? ["rear-guard"] : ["vanguard"], ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "battle" }], ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("all 51 exact Generation Break own-attack power AUTO abilities resolve only for their source on both seats", () => {
  const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === GB_PATTERN).map(ability => ({ card, ability })));
  assert.equal(family.length, 51);
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const legal = fixture({ side, cardId: card.id, pattern: GB_PATTERN });
    const discovery = Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine);
    assert.ok(discovery.queued.some(item => item.ability?.id === ability.id), `${ability.id} is included even when another ability on this unit shares the attack event`);
    assert.equal(legal.state.pendingAbility.side, side, ability.id);
    assert.equal(legal.state.pendingAbility.ability.id, ability.id);
    const resolved = resolve(legal);
    assert.equal(resolved.ok, true, `${ability.id} / ${side}: ${resolved.reason}`);
    assert.equal(legal.state.pendingAttack.power, 10000 + ability.definition.effects[0].amount, ability.id);

    const wrongSource = fixture({ side, cardId: card.id, pattern: GB_PATTERN, attackSource: "other" });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine).queued.length, 0, `${ability.id} unrelated attacker`);

    const noGenerationBreak = fixture({ side, cardId: card.id, pattern: GB_PATTERN });
    noGenerationBreak.state.players[side].gZone = [];
    const withoutGb = Reducer.discoverAutoTriggers(noGenerationBreak.state, [noGenerationBreak.event], Engine).queued;
    assert.equal(withoutGb.some(item => item.ability?.id === ability.id), false, `${ability.id} without GB1`);
  }
});

test("the 27 single-ability GB1 own-Vanguard-attack cards have complete printed-text and trusted-definition coverage", () => {
  const expectedIds = ["cfa-2477", "cfa-2522", "cfa-2524", "cfa-2536", "cfa-2548", "cfa-2550", "cfa-2561", "cfa-2567", "cfa-2577", "cfa-2580", "cfa-2680", "cfa-2684", "cfa-2694", "cfa-2696", "cfa-2747", "cfa-2755", "cfa-2796", "cfa-2818", "cfa-2924", "cfa-2951", "cfa-2958", "cfa-2972", "cfa-2989", "cfa-3380", "cfa-3384", "cfa-3504", "cfa-3518"];
  const actual = catalog.filter(card => {
    const abilities = Engine.parseCardAbilitiesCached(card);
    return abilities.length === 1 && abilities[0].definition?.source?.patternId === GB_PATTERN;
  });
  assert.deepEqual([...actual.map(card => card.id)].sort(), expectedIds.slice().sort());
  for (const card of actual) {
    const [ability] = Engine.parseCardAbilitiesCached(card);
    assert.equal(card.type, "Unit", card.id);
    assert.equal(ability.kind, "AUTO", card.id);
    assert.equal(ability.requiredLocation.includes("rear-guard"), true, card.id);
    assert.match(ability.printedText, /^AUTO \[RC\] Generation Break 1\b/i, card.id);
    assert.match(ability.printedText, /When this unit attacks a vanguard, this unit gets power \+3000 until end of (that )?battle\.$/i, card.id);
    assert.ok(card.text.includes(ability.printedText), `${card.id}: exact parsed skill retained in catalog text`);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(entry => entry.id === ability.id), `${card.id}: trusted definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, card.id);
  }
});

function setRearGuardCount(player, count, prefix) {
  const source = player.rear.find(Boolean) || null;
  player.rear = Array(5).fill(null);
  let slot = 0;
  if (source && count > 0) { player.rear[slot++] = source; }
  while (slot < count && slot < player.rear.length) {
    player.rear[slot] = { uid: `${prefix}-${slot}`, cardId: "cfa-2", ownerPlayerId: player.playerId,
      controllerPlayerId: player.playerId, unitCard: true, grade: 1 };
    slot++;
  }
}

test("all 26 rear-guard-advantage attack abilities are trusted with their printed circle, condition, and amount", () => {
  const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === ADVANTAGE_PATTERN).map(ability => ({ card, ability })));
  assert.equal(family.length, 26);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    assert.equal(ability.trigger.eventType, "unit.attacked", ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.deepEqual(ability.conditions, [{ type: "controller-has-more-rear-guards-than-opponent" }], ability.id);
    assert.equal(ability.definition.effects[0].amount, Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test("both players resolve all 26 rear-guard-advantage AUTO abilities only for the exact attacking instance", () => {
  const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === ADVANTAGE_PATTERN).map(ability => ({ card, ability })));
  for (const { card, ability } of family) for (const side of ["human", "bot"]) {
    const legal = fixture({ side, cardId: card.id, pattern: ADVANTAGE_PATTERN, abilityId: ability.id });
    setRearGuardCount(legal.state.players[side], 3, `${ability.id}-${side}-own`);
    setRearGuardCount(legal.state.players[side === "human" ? "bot" : "human"], 1, `${ability.id}-${side}-opponent`);
    const powerBefore = legal.state.pendingAttack.power;
    assert.equal(Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine).queued.length, 1, `${ability.id}:${side}`);
    assert.equal(legal.state.pendingAbility.side, side, `${ability.id}:${side}`);
    const resolved = resolve(legal);
    assert.equal(resolved.ok, true, `${ability.id}:${side}: ${resolved.reason}`);
    assert.equal(legal.state.pendingAttack.power, powerBefore + ability.definition.effects[0].amount, `${ability.id}:${side}`);

    const insufficient = fixture({ side, cardId: card.id, pattern: ADVANTAGE_PATTERN, abilityId: ability.id });
    setRearGuardCount(insufficient.state.players[side], 1, `${ability.id}-${side}-tie-own`);
    setRearGuardCount(insufficient.state.players[side === "human" ? "bot" : "human"], 1, `${ability.id}-${side}-tie-opponent`);
    assert.equal(Reducer.discoverAutoTriggers(insufficient.state, [insufficient.event], Engine).queued.length, 0, `${ability.id}:${side} equal counts`);

    const wrongSource = fixture({ side, cardId: card.id, pattern: ADVANTAGE_PATTERN, abilityId: ability.id, attackSource: "other" });
    setRearGuardCount(wrongSource.state.players[side], 3, `${ability.id}-${side}-other-own`);
    setRearGuardCount(wrongSource.state.players[side === "human" ? "bot" : "human"], 1, `${ability.id}-${side}-other-opponent`);
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine).queued.length, 0, `${ability.id}:${side} other attacker`);
  }
});

test("host and joining player resolve only their own exact-source attack AUTO", () => {
  const vcCardId = reviewed.find(item => item.ability.requiredLocation.length === 1 && item.ability.requiredLocation[0] === "vanguard").card.id;
  const rcCardId = reviewed.find(item => item.ability.requiredLocation.length === 1 && item.ability.requiredLocation[0] === "rear-guard").card.id;
  for (const [side, cardId] of [["human", vcCardId], ["bot", rcCardId]]) {
    const f = fixture({ side, cardId });
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.pendingAttack.power, 10000 + f.amount);
    assert.equal(f.state.pendingAbility, null);
  }
});

test("other attackers, rear-guard targets, wrong actor, and replay cannot resolve this source ability", () => {
  const cardId = reviewed.find(item => item.ability.requiredLocation[0] === "rear-guard").card.id;
  const wrongSource = fixture({ cardId, attackSource: "other" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine).queued.length, 0);
  const wrongTarget = fixture({ cardId, targetLocation: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0);
  const f = fixture({ cardId });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  const denied = resolve(f, "auth-host");
  assert.equal(denied.ok, false);
  assert.equal(JSON.stringify(f.state), before);
  const accepted = resolve(f);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.state.pendingAttack.power, 10000 + f.amount);
});

test("cfa-3406 is fully covered: its only printed ability resolves for either Vanguard and rejects unrelated attackers", () => {
  const card = cardDefinition("cfa-3406");
  const abilities = Engine.parseCardAbilitiesCached(card);
  assert.equal(abilities.length, 1, "every printed ability on this card is included in the verification scope");
  const ability = abilities[0];
  assert.equal(ability.id, "cfa-3406:0");
  assert.equal(ability.definition?.source?.patternId, PATTERN);
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]);
  for (const side of ["human", "bot"]) {
    const wrong = fixture({ side, cardId: "cfa-3406", attackSource: "other" });
    assert.equal(Reducer.discoverAutoTriggers(wrong.state, [wrong.event], Engine).queued.length, 0);
    assert.equal(wrong.state.pendingAbility, null);
    const legal = fixture({ side, cardId: "cfa-3406" });
    assert.equal(Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine).queued.length, 1);
    assert.equal(legal.state.pendingAbility.side, side);
    const result = resolve(legal);
    assert.equal(result.ok, true, result.reason);
    assert.equal(legal.state.pendingAttack.power, 12000);
    assert.equal(legal.source.turnPowerBoost || 0, 0, "the +2000 is limited to this battle");
  }
});

test("all 11 any-target own-attack abilities retain their trusted circle, printed power, and battle duration", () => {
  const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === ANY_TARGET_PATTERN).map(ability => ({ card, ability })));
  assert.equal(family.length, 11);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    const circle = ability.printedText.match(/\[(VC\/RC|VC|RC)\]/i)?.[1]?.toUpperCase();
    const expectedLocation = circle === "VC/RC" ? ["vanguard", "rear-guard"] : circle === "RC" ? ["rear-guard"] : ["vanguard"];
    assert.deepEqual(ability.requiredLocation, expectedLocation, ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "battle" }], ability.id);
  }
});

test("own-attack abilities without a target restriction still trigger against either opposing circle", () => {
  const cardId = catalog.find(card => Engine.parseCardAbilitiesCached(card).some(ability =>
    ability.definition?.source?.patternId === ANY_TARGET_PATTERN))?.id;
  assert.ok(cardId);
  for (const [side, targetLocation] of [["human", "vanguard"], ["bot", "rear-left"]]) {
    const f = fixture({ side, cardId, pattern: ANY_TARGET_PATTERN, targetLocation });
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.pendingAttack.power, 10000 + f.amount);
  }
});

test("all 42 clan-gated own-attack abilities retain exact clan, source circle, and battle power", () => {
  const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === CLAN_PATTERN).map(ability => ({ card, ability })));
  assert.equal(family.length, 42);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.equal(ability.trigger.targetLocation, /attacks? a vanguard/i.test(ability.printedText) ? "vanguard" : null, ability.id);
    assert.equal(ability.conditions.length, 1, ability.id);
    assert.equal(ability.conditions[0].type, "controller-vanguard-has-clan", ability.id);
    assert.equal(ability.conditions[0].value, ability.printedText.match(/«([^»]+)»|<([^>]+)>/)?.slice(1).find(Boolean), ability.id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "battle" }], ability.id);
  }
});

test("clan-gated own attacks prompt and resolve for each owner only with their controller Vanguard clan", () => {
  const vc = reviewedClanCard("vanguard");
  const rc = reviewedClanCard("rear-guard");
  for (const [side, sample] of [["human", vc], ["bot", rc]]) {
    const clan = sample.ability.conditions[0].value;
    const valid = fixture({ side, cardId: sample.card.id, pattern: CLAN_PATTERN, vanguardClan: clan });
    assert.equal(Reducer.discoverAutoTriggers(valid.state, [valid.event], Engine).queued.length, 1);
    assert.equal(valid.state.pendingAbility.side, side);
    const resolved = resolve(valid);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(valid.state.pendingAttack.power, 10000 + valid.amount);

    if (sample.ability.requiredLocation.includes("rear-guard") && !sample.ability.requiredLocation.includes("vanguard")) {
      const wrongClan = fixture({ side, cardId: sample.card.id, pattern: CLAN_PATTERN, vanguardClan: "Unrelated Clan" });
      assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
      assert.equal(wrongClan.state.pendingAbility, null);
      assert.equal(wrongClan.state.pendingAttack.power, 10000);
    }
  }
});

function reviewedClanCard(circle) {
  const entry = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
    .filter(ability => ability.definition?.source?.patternId === CLAN_PATTERN).map(ability => ({ card, ability })))
    .find(item => circle === "vanguard" ? item.ability.requiredLocation.includes("vanguard") :
      item.ability.requiredLocation.includes("rear-guard") && !item.ability.requiredLocation.includes("vanguard"));
  assert.ok(entry, `clan family has an exact ${circle} card`);
  return entry;
}
