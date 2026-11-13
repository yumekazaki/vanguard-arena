"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-PRIMARY-WORKER-CONT-DIVINE-SKILL-ATTACK-LOCK-6.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
Engine.registerAbilityDefinitions(contribution);

// Exact snapshot text, including U+2019 in the two opponent-count abilities.
const CONT = "CONT: This unit cannot be ridden, and if you did not use [Divine Skill] this fight, this unit cannot attack.";
const AUTO = "AUTO [RC]: When this unit attacks, this unit gets power +2000 until end of that battle ";
const cases = [
  ["cfa-13049", "Divine Sister, Granite", "for each of your rear-guards.", "controller Rear-Guards including this source"],
  ["cfa-13057", "Roaring Tides Dragon, Hadal Crash Dragon", "for every five cards in your drop.", "floor(controller Drop count / 5)"],
  ["cfa-13060", "Great Axe Severing Slash Colossus", "for every three cards in your soul.", "floor(controller Soul count / 3)"],
  ["cfa-13071", "Accident Squall, Annasia", "for each of your opponent’s rear-guards.", "opponent Rear-Guards"],
  ["cfa-13083", "Gould Segment Dragon", "for each set order in your order zone.", "controller Set Orders only"],
  ["cfa-13113", "Dissect Gale Dragon", "for each of your opponent’s open RC.", "opponent open RC; locked circles require rules review"]
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(card, side) {
  const otherSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host" : "guest";
  const otherId = side === "human" ? "guest" : "host";
  const instance = (uid, cardId, controller, grade = 3) => ({ uid, cardId, grade, unitCard: true,
    cardName: cardId === card.id ? card.name : "Fixture Vanguard", power: 15000, critical: 1,
    ownerPlayerId: controller, controllerPlayerId: controller, rested: false });
  const source = instance("source", card.id, ownerId);
  const player = (id, uid) => ({ playerId: id, vanguard: instance(uid, "fixture-vg", id),
    rear: Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [],
    orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const own = player(ownerId, "own-vg"), opponent = player(otherId, "target-vg");
  own.rear[0] = source;
  const state = { matchId: "divine-batch", stateVersion: 1, turn: 4, phase: 5, side,
    firstTurnComplete: true, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null,
    players: { [side]: own, [otherSide]: opponent } };
  const auth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId,
    turnPlayerId: ownerId, sourceCardInstanceId: source.uid, cardInstanceId: source.uid,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "rear-guard", currentLocation: "rear-guard", phase: "battle",
    timingWindow: "attack-declared", battleId: "batch-battle", targetLocation: "vanguard",
    targetCardInstanceIds: [opponent.vanguard.uid] });
  return { state, own, opponent, source, event, auth, side };
}

test("reservation and empty contribution do not claim partial implementations", () => {
  const batches = require("./ability-work-batches.json");
  function find(value) {
    if (!value || typeof value !== "object") return null;
    if (value.batchId === "PRIMARY-WORKER-CONT-DIVINE-SKILL-ATTACK-LOCK-6") return value;
    return Object.values(value).map(find).find(Boolean);
  }
  const batch = find(batches);
  assert.ok(batch);
  assert.equal(batch.workerOwner, "worker-divine-skill-attack-lock");
  assert.deepEqual([...batch.cardIds].sort(), cases.map(row => row[0]).sort());
  assert.deepEqual([...batch.abilityIds].sort(), cases.flatMap(row => [row[0] + ":0", row[0] + ":1"]).sort());
  assert.deepEqual(contribution, []);
});

for (const [cardId, name, suffix, countReview] of cases) {
  const card = catalog.find(card => card.id === cardId);
  test(`${cardId}: both exact printed blocks and separate own-attack identity survive parsing`, () => {
    assert.ok(card);
    assert.equal(card.name, name);
    const abilities = Engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, 2);
    assert.deepEqual(abilities.map(a => a.id), [cardId + ":0", cardId + ":1"]);
    assert.equal(abilities[0].kind, "CONT");
    assert.equal(abilities[0].printedText, CONT);
    assert.deepEqual(abilities[0].requiredLocation, []);
    assert.equal(abilities[1].kind, "AUTO");
    assert.equal(abilities[1].printedText, AUTO + suffix);
    assert.deepEqual(abilities[1].requiredLocation, ["rear-guard"]);
    assert.equal(abilities[1].trigger.eventType, "unit.attacked");
    assert.equal(abilities[1].trigger.subject, "source");
    assert.deepEqual(abilities[1].costs, []);
    assert.equal(abilities[1].canDecline, false);
    for (const ability of abilities) {
      assert.equal(ability.definition, null);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false);
      assert.equal(Engine.isManuallyActivatable(ability), false);
    }
  });

  test(`${cardId}:1: parsed trigger matches only the exact own attacking RC instance`, () => {
    const ability = Engine.parseCardAbilitiesCached(card)[1];
    const f = fixture(card, "human");
    const matches = (event = f.event, zone = "rear-left", type = "attack") =>
      Engine.eventMatchesAbilityTrigger(ability, type, event, f.source.uid, zone, zone, "host");
    assert.equal(matches(), true, "parsing evidence only, not an implemented effect");
    assert.equal(matches({ ...f.event, sourceCardInstanceId: "other-copy", cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy" }), false);
    assert.equal(matches(f.event, "vanguard"), false);
    assert.equal(matches(f.event, "hand"), false);
    assert.equal(matches({ ...f.event, type: "card.placed" }), false);
    assert.equal(matches(f.event, "rear-left", "boost"), false);
  });

  for (const side of ["human", "bot"]) {
    test(`${cardId}/${side}: unsupported blocks reject manual activation and unsolicited/replayed responses unchanged`, () => {
      for (const ability of Engine.parseCardAbilitiesCached(card)) {
        const f = fixture(card, side);
        const before = JSON.stringify(f.state);
        const command = { actorAuthUid: f.auth, actionId: "manual", expectedStateVersion: 1,
          payload: { sourceCardInstanceId: f.source.uid, abilityId: ability.id } };
        assert.equal(Reducer.applyManualAbilityActivation(f.state, command, seats, Engine).ok, false);
        assert.equal(JSON.stringify(f.state), before);
        for (const actorAuthUid of [f.auth, side === "human" ? seats.guestAuthUid : seats.hostAuthUid]) {
          for (const expectedStateVersion of [1, 0]) {
            const response = { actorAuthUid, actionId: "unsolicited", expectedStateVersion,
              payload: { type: "ability-response", accept: true,
                selection: { instanceUid: f.source.uid, abilityId: ability.id } } };
            for (let repeat = 0; repeat < 2; repeat++) {
              assert.equal(Reducer.applyAbilityDecision(f.state, response, seats, Engine).ok, false);
              assert.equal(JSON.stringify(f.state), before);
            }
          }
        }
      }
    });

    test(`${cardId}/${side}: unsupported AUTO never queues an executable fixed-power substitute`, () => {
      const f = fixture(card, side);
      const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(result.queued.length, 0);
      assert.equal(f.state.pendingAbility, null);
      assert.equal(f.source.turnPowerBoost, undefined);
    });

    // Executable red specifications: TODO means missing shared implementation,
    // not success evidence. No invented Divine Skill state field is supplied.
    test(`${cardId}/${side}: reject normal ride even with otherwise legal grade`, { todo: "complete compound CONT and authoritative ride metadata required" }, () => {
      const f = fixture(card, side);
      f.state.phase = 2;
      f.own.rear[0] = null;
      f.own.hand.push(f.source);
      f.own.vanguard.grade = 2;
      const before = JSON.stringify(f.state);
      const result = Reducer.applyGameAction(f.state, { actorAuthUid: f.auth, actionId: "ride",
        expectedStateVersion: 1, payload: { action: "ride", cardInstanceId: f.source.uid } }, seats, Engine);
      assert.equal(result.ok, false, "printed cannot-be-ridden must prevent riding");
      assert.equal(JSON.stringify(f.state), before);
    });

    test(`${cardId}/${side}: reject own RC attack before any Divine Skill use`, { todo: "trusted per-controller fight history and continuous attack restriction required" }, () => {
      const f = fixture(card, side), before = JSON.stringify(f.state);
      const result = Reducer.applyGameAction(f.state, { actorAuthUid: f.auth, actionId: "attack",
        expectedStateVersion: 1, payload: { action: "attack", attackerCardInstanceId: f.source.uid,
          targetCardInstanceId: f.opponent.vanguard.uid } }, seats, Engine);
      assert.equal(result.ok, false, "no Divine Skill has been used in this fresh fixture");
      assert.equal(JSON.stringify(f.state), before);
    });

    test.todo(`${cardId}/${side}: successful own attack after controller's authoritative Divine Skill use; opponent use insufficient; history persists across turns and resets between fights`);
    test(`${cardId}:1/${side}: mandatory source-only battle power uses ${countReview}`, { todo: "reviewed count-based AUTO operation required in engine and reducer" }, () => {
      const f = fixture(card, side);
      f.state.pendingAttack = { battleId: "batch-battle", attackerUid: f.source.uid,
        attackerSide: side, attackerZone: "rear-left", attackerPlayerId: f.own.playerId,
        defenderSide: side === "human" ? "bot" : "human", targetUid: f.opponent.vanguard.uid,
        targetZone: "vanguard", power: 15000, targetPower: 15000, critical: 1 };
      // Granite's count is one (the source); all other initial counts are zero,
      // except Dissect Gale's five empty opponent circles. Zero must still resolve.
      const amount = cardId === "cfa-13049" ? 2000 : cardId === "cfa-13113" ? 10000 : 0;
      assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
      const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.auth,
        actionId: "resolve-count", expectedStateVersion: f.state.stateVersion,
        payload: { type: "ability-response", accept: true,
          selection: { instanceUid: f.source.uid, abilityId: cardId + ":1" } } }, seats, Engine);
      assert.equal(result.ok, true);
      assert.equal(f.state.pendingAttack.power, 15000 + amount);
    });
    test.todo(`${cardId}:1/${side}: reject wrong attacker, same-card different UID, wrong event, wrong circle, foreign controller and stale battle; duplicate event/response never reapplies power`);
    test.todo(`${cardId}:1/${side}: snapshot count at resolution; retain power after counted cards move; expire at battle end; new attack gets an independent amount`);
  }
}

test("otherwise legal plain-unit controls can ride and attack for both seats", () => {
  const plain = catalog.find(card => card.id === "cfa-3");
  assert.ok(plain);
  for (const side of ["human", "bot"]) {
    const attack = fixture(plain, side);
    const attackResult = Reducer.applyGameAction(attack.state, { actorAuthUid: attack.auth,
      actionId: "control-attack", expectedStateVersion: 1, payload: { action: "attack",
        attackerCardInstanceId: attack.source.uid, targetCardInstanceId: attack.opponent.vanguard.uid } }, seats, Engine);
    assert.equal(attackResult.ok, true, attackResult.reason);
    const ride = fixture(plain, side);
    ride.state.phase = 2;
    ride.own.rear[0] = null;
    ride.own.hand.push(ride.source);
    ride.own.vanguard.grade = 2;
    const rideResult = Reducer.applyGameAction(ride.state, { actorAuthUid: ride.auth,
      actionId: "control-ride", expectedStateVersion: 1,
      payload: { action: "ride", cardInstanceId: ride.source.uid } }, seats, Engine);
    assert.equal(rideResult.ok, true, rideResult.reason);
  }
});

test("batch audit retains twelve unsupported blocks and zero completed cards", () => {
  const report = auditCatalog(cases.map(([id]) => catalog.find(card => card.id === id)));
  assert.equal(report.abilityBlocks, 12);
  assert.deepEqual(report.byKind, { AUTO: 6, ACT: 0, CONT: 6, OTHER: 0 });
  assert.equal(report.unsupported, 12);
  assert.equal(report.compiled, 0);
  assert.equal(report.cardsWithAllAbilityBlocksCompiledAndAuditValid, 0);
  assert.deepEqual(report.invalidCompiled, []);
});
