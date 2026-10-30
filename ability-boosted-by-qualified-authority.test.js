"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-boosted-by-qualified-unit-power-v1";
const catalog = loadCatalog();
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN).map(ability => ({ card, ability })));
const attackableFamily = family.filter(({ card }) => !Engine.parseCardAbilitiesCached(card)
  .some(ability => ability.definition?.continuousRestrictions?.some(restriction => restriction.type === "restraint")));
const qualifierTestFamily = attackableFamily.filter(({ card }) => !Engine.parseCardAbilitiesCached(card)
  .some(ability => ability.definition?.continuousRestrictions?.some(restriction => restriction.type === "lord")));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function makeUnit(definition, uid, playerId, overrides = {}) {
  const header = String(definition?.text || "").split(/\r?\n/, 1)[0].split("/").map(value => value.trim()).filter(Boolean);
  const clan = definition.clan || definition.clans?.[0] || (header.length > 1 ? header[0] : null);
  const races = definition.races || (definition.race ? [definition.race] : header.slice(1));
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), clan, clans: definition.clans || (clan ? [clan] : []),
    race: definition.race || races[0] || null, races, power: Number(definition.power || 0), critical: Number(definition.critical || 1), drive: Number(definition.drive || 1),
    shield: Number(definition.shield || 0), unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId,
    rested: false, locked: false, ...overrides };
}

function findAbility(cardId, pattern = PATTERN) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === pattern);
  assert.ok(ability, `ability for ${cardId}`);
  return { card, ability };
}

function findBoostCard(ability, wrong = false, requiredClan = null) {
  const field = ability.trigger.boosterClan ? "clan" : "race";
  const qualifier = ability.trigger.boosterClan || ability.trigger.boosterRace;
  const identity = card => {
    const header = String(card?.text || "").split(/\r?\n/, 1)[0].split("/").map(value => value.trim()).filter(Boolean);
    return { clan: card.clan || card.clans?.[0] || (header.length > 1 ? header[0] : null),
      races: card.races || (card.race ? [card.race] : header.slice(1)) };
  };
  return catalog.find(card => {
    if (Number(card.grade) !== 1 || !/unit/i.test(String(card.type || ""))) return false;
    const fields = identity(card), values = field === "clan" ? [fields.clan] : fields.races;
    const matches = values.some(value => String(value || "").toLowerCase() === qualifier.toLowerCase());
    const clanMatches = !requiredClan || String(fields.clan || "").toLowerCase() === requiredClan.toLowerCase();
    return clanMatches && (wrong ? !matches : matches);
  });
}

function setup({ cardId, side = "bot", wrongBooster = false, includeBooster = true, targetZone = "vanguard" } = {}) {
  const { card, ability } = findAbility(cardId);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const sourceAtVanguard = ability.requiredLocation.includes("vanguard");
  const source = makeUnit(card, "boosted-source", ownerId);
  const own = { playerId: ownerId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], damage: [],
    hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  const opponent = { playerId: opponentId,
    vanguard: makeUnit(catalog.find(item => item.id === "cfa-3") || { id: "opponent-vg", grade: 3, power: 10000 }, "opponent-vanguard", opponentId,
      { grade: 3, power: 10000 }),
    rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [] };
  if (sourceAtVanguard) own.vanguard = source;
  else {
    own.vanguard = makeUnit(catalog.find(item => item.id === "cfa-3") || { id: "own-vg", grade: 3, power: 10000 }, "own-vanguard", ownerId,
      { grade: 3, power: 10000 });
    own.rear[0] = source;
  }
  const abilities = Engine.parseCardAbilitiesCached(card);
  const hasLord = abilities.some(item => item.definition?.continuousRestrictions?.some(restriction => restriction.type === "lord"));
  const sourceClan = card.clan || card.clans?.[0];
  const ownVanguardDefinition = hasLord ? catalog.find(item => Number(item.grade) === 3 && /unit/i.test(String(item.type || "")) && String(item.clan || item.clans?.[0] || "").toLowerCase() === String(sourceClan || "").toLowerCase()) : null;
  if (hasLord) assert.ok(ownVanguardDefinition, `${card.id}: same-clan Vanguard exists for the Lord condition`);
  if (!sourceAtVanguard) own.vanguard = makeUnit(ownVanguardDefinition || catalog.find(item => item.id === "cfa-3") || { id: "own-vg", grade: 3, power: 10000 }, "own-vanguard", ownerId, { grade: 3, power: 10000 });
  const boosterDefinition = findBoostCard(ability, wrongBooster, hasLord ? sourceClan : null);
  const booster = includeBooster ? makeUnit(boosterDefinition, "booster", ownerId, { boostAbility: true, power: Number(boosterDefinition.power || 5000) }) : null;
  const boosterIndex = sourceAtVanguard ? 3 : 2;
  if (booster) own.rear[boosterIndex] = booster;
  const secondCopy = makeUnit(card, "same-name-nonattacker", ownerId);
  if (sourceAtVanguard) own.rear[0] = secondCopy;
  else own.rear[4] = secondCopy;
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: `boost-family-${side}-${cardId}`, stateVersion: 2, eventSequence: 0, side, turn: 3, phase: 5,
    firstTurnComplete: true, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, pendingAttack: null, players };
  const target = targetZone === "vanguard" ? opponent.vanguard : (opponent.rear[0] = makeUnit(catalog.find(item => item.id === "cfa-4") || { id: "target", grade: 2, power: 5000 }, "opponent-rear", opponentId));
  const sourceCircle = sourceAtVanguard ? "vanguard" : "rear-left";
  const boosterCircle = sourceAtVanguard ? "rear-center" : "rear-left-back";
  const command = { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `declare-boost-${side}-${cardId}`,
    expectedStateVersion: state.stateVersion, payload: { type: "game-action", action: "attack",
      attackerCardInstanceId: source.uid, targetCardInstanceId: target.uid,
      ...(booster ? { boosterCardInstanceId: booster.uid } : {}) } };
  return { state, ability, source, booster, target, ownerId, side, command, sourceCircle, boosterCircle };
}

function declare(f) { return Reducer.applyGameAction(f.state, f.command, seats, Engine); }

function resolve(f) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? "auth-host" : "auth-guest",
    actionId: `resolve-boost-${f.side}-${f.ability.id}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all 42 qualified-booster abilities are trusted and retain exact clan/race, source circle, amount, and duration", () => {
  assert.equal(family.length, 42);
  assert.equal(family.filter(item => item.ability.trigger.boosterClan).length, 39);
  assert.equal(family.filter(item => item.ability.trigger.boosterRace).length, 3);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    assert.equal(ability.trigger.eventType, "unit.boosted", ability.id);
    assert.equal(ability.trigger.subject, "boosted-unit", ability.id);
    assert.ok(ability.trigger.boosterClan || ability.trigger.boosterRace, ability.id);
    const circle = ability.printedText.match(/\[(VC\/RC|VC|RC)\]/i)?.[1]?.toUpperCase();
    assert.deepEqual(ability.requiredLocation, circle === "VC/RC" ? ["vanguard", "rear-guard"] : circle === "RC" ? ["rear-guard"] : ["vanguard"], ability.id);
    const duration = /until end of turn/i.test(ability.printedText) ? "turn" : "battle";
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source",
      amount: Number(ability.printedText.match(/power \+(\d+)/i)?.[1]), duration }], ability.id);
  }
});

test("21 sole-skill boost cards retain their complete text and structured card metadata", () => {
  const soleSkill = family.filter(({ card }) => Engine.parseCardAbilitiesCached(card).length === 1);
  assert.equal(soleSkill.length, 21);
  assert.equal(new Set(soleSkill.map(({ card }) => String(card.id))).size, 21);
  for (const { card, ability } of soleSkill) {
    assert.ok(card.text.includes(ability.printedText), `${ability.id}: complete printed skill retained`);
    assert.equal(card.type, "Unit", ability.id);
    assert.ok(Number.isFinite(Number(card.grade)), `${ability.id}: grade metadata`);
    assert.ok(Number.isFinite(Number(card.power)), `${ability.id}: power metadata`);
    assert.ok(card.clan || card.clans?.length || String(card.text).split(/\r?\n/, 1)[0].includes("/"), `${ability.id}: clan metadata`);
  }
});

test("every legally attackable qualified booster AUTO resolves for its exact source on either player seat", () => {
  assert.equal(attackableFamily.length, 38);
  for (const sample of attackableFamily) for (const side of ["human", "bot"]) {
    assert.ok(findBoostCard(sample.ability), `${sample.ability.id}: matching Grade 1 booster exists`);
    const f = setup({ cardId: sample.card.id, side });
    const declared = declare(f);
    assert.equal(declared.ok, true, `${side} ${sample.ability.id}: ${declared.reason}`);
    assert.equal(f.state.pendingAbility?.instance.uid, f.source.uid, `${side} ${sample.ability.id}: exact boosted source owns prompt`);
    assert.equal(f.state.pendingAbility?.side, side, `${side} ${sample.ability.id}: controller owns prompt`);
    const event = declared.events.find(item => item.type === "unit.boosted");
    assert.ok(event, `${side} ${sample.ability.id}: structured boost event emitted`);
    if (sample.ability.trigger.boosterClan) assert.ok(event.boosterCardClan === sample.ability.trigger.boosterClan || event.boosterCardClans.includes(sample.ability.trigger.boosterClan), `${sample.ability.id}: exact clan qualifier`);
    if (sample.ability.trigger.boosterRace) assert.ok(event.boosterCardRace === sample.ability.trigger.boosterRace || event.boosterCardRaces.includes(sample.ability.trigger.boosterRace), `${sample.ability.id}: exact race qualifier`);
    assert.equal(event.boosterCardInstanceId, f.booster.uid, `${side} ${sample.ability.id}: exact booster identity`);
    assert.equal(event.boostedCardInstanceId, f.source.uid, `${side} ${sample.ability.id}: exact boosted identity`);
    const basePower = f.state.pendingAttack.power;
    const result = resolve(f);
    assert.equal(result.ok, true, `${side} ${sample.ability.id}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, basePower + sample.ability.definition.effects[0].amount, `${side} ${sample.ability.id}: only its own source gets battle power`);
  }
});

test("wrong clan/race boosters and unboosted attacks never prompt qualified-booster abilities", () => {
  for (const sample of qualifierTestFamily) for (const side of ["human", "bot"]) {
    assert.ok(findBoostCard(sample.ability, true), `${sample.ability.id}: nonmatching Grade 1 booster exists`);
    const wrong = setup({ cardId: sample.card.id, side, wrongBooster: true });
    const wrongResult = declare(wrong);
    assert.equal(wrongResult.ok, true, `${side} ${sample.ability.id}: ${wrongResult.reason}`);
    assert.equal(wrong.state.pendingAbility, null, `${side} ${sample.ability.id}: unrelated booster qualifier rejected`);
    const unboosted = setup({ cardId: sample.card.id, side, includeBooster: false });
    const plainAttack = declare(unboosted);
    assert.equal(plainAttack.ok, true, `${side} ${sample.ability.id}: ${plainAttack.reason}`);
    assert.equal(unboosted.state.pendingAbility, null, `${side} ${sample.ability.id}: no booster, no trigger`);
  }
});

test("a qualified-booster AUTO cannot bypass another CONT ability's Restraint attack restriction", () => {
  const sample = family.find(({ card }) => Engine.parseCardAbilitiesCached(card)
    .some(ability => ability.definition?.continuousRestrictions?.some(restriction => restriction.type === "restraint")));
  assert.ok(sample, "a multi-skill card has both Restraint and the qualified-booster AUTO");
  const f = setup({ cardId: sample.card.id, side: "bot" });
  const result = declare(f);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unit-with-restraint-cannot-attack");
  assert.equal(f.state.pendingAbility, null, "an illegal attack cannot generate a boost-trigger prompt");
});
