"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = "auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1";

function definition(cardId) {
  const found = catalog.find(card => String(card.id) === String(cardId));
  assert.ok(found, `catalog definition ${cardId} exists`);
  return found;
}

function makeInstance(card, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit",
    grade: Number(card.grade), ...(card.clan ? { clan: card.clan } : {}),
    ...(Array.isArray(card.clans) ? { clans: [...card.clans] } : {}),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function namedDropDefinition(ability) {
  const name = ability.definition.effects[1].condition.cardName;
  const card = catalog.find(item => String(item.name || "").toLocaleLowerCase() === name.toLocaleLowerCase());
  assert.ok(card, `the catalog contains the exact required Drop card ${name}`);
  return card;
}

function setup({ namedDrop = true, hostHasName = false, damage = true } = {}) {
  const sourceDefinition = definition("cfa-2549");
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === FAMILY);
  assert.ok(ability);
  assert.match(ability.printedText, /^AUTO: When this unit is placed on GC from hand, COST \[discard a card from hand\], choose one of your vanguards being attacked, and it cannot be hit until end of that battle\. If your drop has a ".+", Counter Charge 1\.$/);
  assert.deepEqual(ability.definition.effects.map(step => step.op), ["protect-target", "conditional-counter-charge"]);
  Engine.registerAbilityDefinitions([ability.definition]);

  const discard = makeInstance(definition("cfa-2"), "guest-cost", "guest");
  const source = makeInstance(sourceDefinition, "guest-guardian", "guest", { zone: "guardian", circle: "guardian" });
  const guestVanguard = makeInstance(definition("cfa-3"), "guest-vanguard", "guest");
  const hostVanguard = makeInstance(definition("cfa-3"), "host-vanguard", "host");
  const guestDamage = damage ? [{ uid: "guest-damage-1", cardId: "cfa-2", ownerPlayerId: "guest", controllerPlayerId: "guest", faceDown: true }, { uid: "guest-damage-2", cardId: "cfa-2", ownerPlayerId: "guest", controllerPlayerId: "guest", faceDown: true }] : [];
  const hostDamage = [{ uid: "host-damage-1", cardId: "cfa-2", ownerPlayerId: "host", controllerPlayerId: "host", faceDown: true }];
  const guestDrop = namedDrop ? [makeInstance(namedDropDefinition(ability), "guest-name-in-drop", "guest")] : [];
  const hostDrop = hostHasName ? [makeInstance(namedDropDefinition(ability), "host-name-in-drop", "host")] : [];
  const state = {
    matchId: "conditional-counter-charge", stateVersion: 1, turn: 5, side: "human", phase: 3,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [],
    players: {
      human: { playerId: "host", vanguard: hostVanguard, rear: [], hand: [], soul: [], drop: hostDrop, deck: [], damage: hostDamage, bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
      bot: { playerId: "guest", vanguard: guestVanguard, rear: [], hand: [discard], soul: [], drop: guestDrop, deck: [], damage: guestDamage, bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] }
    },
    pendingAttack: {
      battleId: "conditional-cc-battle", attackerSide: "human", attackerUid: hostVanguard.uid, attackerZone: "vanguard",
      defenderSide: "bot", targetUid: guestVanguard.uid, targetZone: "vanguard", guardCards: [], power: 23000, targetPower: 13000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: "guest", turnPlayerId: "host",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest",
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest",
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovery.queued.length, 1);
  return { state, ability, source, discard, guestVanguard, namedDrop: guestDrop[0] || null };
}

function resolve(fixture, actorAuthUid = "auth-guest", targetUid = fixture.guestVanguard.uid, actionId = "resolve-named-cc") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id, targetUid,
      costSelections: { cb: [], sb: [], discard: [fixture.discard.uid], reveal: [] }
    } }
  }, seats, Engine);
}

test("only the exact 24 named-Drop G-Guardian definitions match the supported source text and effect sequence", () => {
  const family = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === FAMILY) family.push({ card, ability });
  }
  assert.equal(family.length, 24);
  assert.equal(new Set(family.map(item => item.card.id)).size, 24);
  for (const { card, ability } of family) {
    assert.equal(ability.definition.cardId, card.id);
    assert.match(ability.printedText, /^AUTO: When this unit is placed on GC from hand, COST \[discard a card from hand\], choose one of your vanguards being attacked, and it cannot be hit until end of that battle\. If your drop has a ".+", Counter Charge 1\.$/);
    assert.deepEqual(ability.definition.effects.map(step => step.op), ["protect-target", "conditional-counter-charge"]);
    assert.equal(ability.definition.effects[1].condition.cardName, ability.printedText.match(/If your drop has a "([^"]+)"/i)[1]);
  }
  assert.equal(Reducer.supportsServerEffectOperation("conditional-counter-charge"), false,
    "the op is not generally enabled; only the exact trusted family is admitted by reducer checks");
});

test("matching name in the joining player's Drop charges only that player's damage", () => {
  const fixture = setup();
  const result = resolve(fixture);
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.equal(fixture.state.pendingAttack.blocked, true);
  assert.deepEqual(fixture.state.players.bot.damage.map(card => card.faceDown), [false, true]);
  assert.deepEqual(fixture.state.players.human.damage.map(card => card.faceDown), [true]);
  assert.deepEqual(fixture.state.players.bot.drop.map(card => card.uid), [fixture.namedDrop.uid, fixture.discard.uid]);
});

test("an opponent's Drop name does not satisfy the controller's condition", () => {
  const fixture = setup({ namedDrop: false, hostHasName: true });
  const result = resolve(fixture);
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.deepEqual(fixture.state.players.bot.damage.map(card => card.faceDown), [true, true]);
  assert.deepEqual(fixture.state.players.human.damage.map(card => card.faceDown), [true]);
});

test("wrong actor, stale target, and wrong defender side reject atomically", () => {
  const wrongActor = setup();
  const beforeWrongActor = JSON.stringify(wrongActor.state);
  assert.equal(resolve(wrongActor, "auth-host").reason, "source-not-controlled");
  assert.equal(JSON.stringify(wrongActor.state), beforeWrongActor);

  const staleTarget = setup();
  const beforeStaleTarget = JSON.stringify(staleTarget.state);
  assert.equal(resolve(staleTarget, "auth-guest", "another-card", "stale-target").reason, "stale-or-invalid-protection-target");
  assert.equal(JSON.stringify(staleTarget.state), beforeStaleTarget);

  const wrongDefense = setup();
  wrongDefense.state.pendingAttack.defenderSide = "human";
  const beforeWrongDefense = JSON.stringify(wrongDefense.state);
  assert.equal(resolve(wrongDefense).reason, "protection-battle-not-defending-controller");
  assert.equal(JSON.stringify(wrongDefense.state), beforeWrongDefense);
});

test("invalid later conditional effect cannot leave earlier protection or discard partially applied", () => {
  const fixture = setup();
  fixture.state.players.bot.damage = undefined;
  const before = JSON.stringify(fixture.state);
  const result = resolve(fixture);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-effect");
  assert.equal(JSON.stringify(fixture.state), before);
});
