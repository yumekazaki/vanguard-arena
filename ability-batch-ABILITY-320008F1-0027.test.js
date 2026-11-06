"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0027.js");
const fs = require("node:fs");
const path = require("node:path");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsed = new Map(catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => [ability.id, ability])));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function attackFixture(abilityId, side = "human", options = {}) {
  const ability = parsed.get(abilityId);
  assert.ok(ability, abilityId);
  const card = cards.get(ability.cardId);
  const sourceIsVanguard = abilityId === "cfa-1072:0";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const source = {
    uid: "source-" + abilityId + "-" + side,
    cardId: card.id,
    cardName: card.name,
    grade: Number(card.grade || 0),
    power: Number(card.power || 10000),
    clan: card.clan || "Narukami",
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    unitCard: true
  };
  const ownVanguard = sourceIsVanguard ? source : {
    uid: "vanguard-" + side,
    cardId: "narukami-vanguard-fixture",
    cardName: "Narukami Vanguard Fixture",
    grade: 3,
    clan: options.vanguardClan || "Narukami",
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    unitCard: true
  };
  const opponentVanguard = {
    uid: "opponent-vanguard-" + side,
    cardId: "opponent-vanguard-fixture",
    cardName: "Opponent Vanguard Fixture",
    grade: 3,
    ownerPlayerId: opponentId,
    controllerPlayerId: opponentId,
    unitCard: true
  };
  const own = {
    playerId,
    vanguard: ownVanguard,
    rear: Array(5).fill(null),
    damage: Array.from({ length: options.damageCount ?? 4 }, (_, index) => ({
      uid: "damage-" + side + "-" + index, faceUp: true, faceDown: false,
      ownerPlayerId: playerId, controllerPlayerId: playerId
    })),
    hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [],
    guardCircle: [], triggerZone: [], gZone: [], gDeck: []
  };
  const enemy = {
    playerId: opponentId,
    vanguard: opponentVanguard,
    rear: Array(5).fill(null),
    damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [],
    guardCircle: [], triggerZone: [], gZone: [], gDeck: []
  };
  const sourceZone = sourceIsVanguard ? "vanguard" : "rear-left";
  if (!sourceIsVanguard) own.rear[0] = source;
  const battleId = "battle-" + abilityId + "-" + side;
  const state = {
    matchId: "batch-0027-" + abilityId + "-" + side,
    stateVersion: 1,
    eventSequence: 0,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    turn: 2,
    side,
    phase: 5,
    players: side === "human" ? { human: own, bot: enemy } : { human: enemy, bot: own },
    pendingAttack: {
      battleId,
      attackerSide: side,
      attackerPlayerId: playerId,
      attackerUid: options.otherAttacker ? "different-source-instance" : source.uid,
      attackerZone: sourceZone,
      defenderSide: opponentSide,
      defenderPlayerId: opponentId,
      targetUid: opponentVanguard.uid,
      targetZone: "vanguard",
      power: source.power,
      targetPower: 13000,
      critical: 1
    }
  };
  const attackerUid = options.otherAttacker ? "different-source-instance" : source.uid;
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked",
    actingPlayerId: playerId,
    turnPlayerId: playerId,
    sourceCardInstanceId: attackerUid,
    sourceOwnerPlayerId: playerId,
    sourceControllerPlayerId: playerId,
    subjectCardInstanceId: attackerUid,
    subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId,
    attackingCardInstanceIds: [attackerUid],
    currentLocation: sourceZone,
    targetCardInstanceIds: [opponentVanguard.uid],
    targetLocation: "vanguard",
    battleId,
    phase: "battle",
    timingWindow: "attack-declared"
  });
  return { ability, state, source, event, side, playerId };
}

function resolveAttack(fixture) {
  const discovered = Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine);
  const queued = discovered.queued.find(item => item.ability?.id === fixture.ability.id);
  assert.ok(queued, fixture.ability.id + " should be queued: " + JSON.stringify(discovered.skipped));
  assert.equal(fixture.state.pendingAbility.side, fixture.side);
  const result = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: "resolve-" + fixture.ability.id + "-" + fixture.side,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } }
  }, seats, Engine);
  assert.equal(result.ok, true, fixture.ability.id + "/" + fixture.side + ": " + result.reason);
}

test("batch 0027 matches its unique catalog ability IDs and the four existing server-supported skills", () => {
  const queuedAbilityCounts = new Map();
  for (const batch of require("./ability-work-batches.json").batches) {
    for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
  }
  assert.ok(audit.abilityIds.every(id => queuedAbilityCounts.get(id) === 1), "historical audit IDs stay tracked exactly once after queue regrouping");
  assert.equal(audit.abilityIds.length, 35);
  assert.equal(new Set(audit.abilityIds).size, 35);
  assert.deepEqual([...audit.alreadySupportedAbilityIds].sort(), [
    "cfa-10717:0", "cfa-1072:0", "cfa-1072:1", "cfa-10730:0"
  ]);
  assert.equal(audit.supportedDefinitions.length, 4);
  assert.equal(audit.proposedDefinitions.length, 0);
  assert.equal(audit.unsupportedSiblings.length, 31);
});

test("all batch abilities are classified by exact parsed card instance text and authoritative support", () => {
  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 31);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, "catalog ability " + abilityId);
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    assert.ok(ability.printedText.length > 10, abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, abilityId + " has a reviewed production definition");
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
      assert.ok(audit.supportedDefinitions.some(item => item.abilityId === abilityId && item.serverHandlerSupported));
      assert.equal(blocked.has(abilityId), false);
    } else {
      const item = blocked.get(abilityId);
      assert.equal(ability.definition, null, abilityId + " stays unsupported");
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, abilityId);
      assert.equal(item?.catalogPrintedText, ability.printedText, abilityId);
      assert.ok(item?.blocker?.length > 50, abilityId + " has a concrete blocker");
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("official text reviews use Bushiroad card-list sources and do not promote unsupported abilities", () => {
  assert.equal(audit.verifiedOfficialAbilities.length, 6);
  for (const item of audit.verifiedOfficialAbilities) {
    assert.ok(audit.abilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
    assert.ok(item.officialPrintedText.length > 25);
  }
  for (const supported of audit.supportedDefinitions) {
    const official = audit.verifiedOfficialAbilities.find(item => item.abilityId === supported.abilityId);
    assert.ok(official, supported.abilityId);
    assert.equal(supported.officialReference, official.officialReference);
    assert.equal(supported.officialPrintedText, official.officialPrintedText);
  }
  for (const id of ["cfa-10717:1", "cfa-10730:1"]) {
    assert.equal(parsed.get(id).definition, null, id + " remains unsupported despite official text review");
    assert.ok(audit.unsupportedSiblings.find(item => item.abilityId === id).officialReference);
  }
});

test("the exact Discharging Dragon attacks resolve only from their source for host and joining player", () => {
  for (const abilityId of ["cfa-1072:0", "cfa-1072:1"]) {
    for (const side of ["human", "bot"]) {
      const legal = attackFixture(abilityId, side);
      resolveAttack(legal);
      const expected = Number(legal.ability.definition.effects[0].amount);
      assert.equal(legal.state.pendingAttack.power, legal.source.power + expected, abilityId + "/" + side);
      assert.equal(legal.state.pendingAbility, null);

      const unrelated = attackFixture(abilityId, side, { otherAttacker: true });
      assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0,
        abilityId + "/" + side + " unrelated card cannot satisfy this source's attack trigger");
    }
  }
});

test("Discharging Dragon Limit Break does not prompt below four damage and its Rear-Guard skill checks the Vanguard clan", () => {
  for (const side of ["human", "bot"]) {
    const belowLimitBreak = attackFixture("cfa-1072:0", side, { damageCount: 3 });
    assert.equal(Reducer.discoverAutoTriggers(belowLimitBreak.state, [belowLimitBreak.event], Engine).queued.length, 0);
    const wrongClan = attackFixture("cfa-1072:1", side, { vanguardClan: "Kagero" });
    assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
  }
});

test("the existing Dragontree marker integration explicitly covers both batch marker cards", () => {
  const source = fs.readFileSync(path.join(__dirname, "ability-auto-dragontree-marker-server.test.js"), "utf8");
  assert.match(source, /cfa-10717/);
  assert.match(source, /cfa-10730/);
  assert.match(source, /host and joining player privately resolve their own marker choice and Counter Blast/);
});
