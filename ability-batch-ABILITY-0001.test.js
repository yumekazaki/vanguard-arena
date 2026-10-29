"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const BaselineEngine = require("./ability-engine.js");
// Candidate definitions exist only in this isolated test engine.
delete require.cache[require.resolve("./ability-engine.js")];
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-0001.js");
const definitions = [
  {
    id: "cfa-100:1",
    cardId: "cfa-100",
    kind: "AUTO",
    printedText: "AUTO [VC]: When this unit attacks a vanguard, it gets power +3000 until end of turn.\n\n(SHIFT + left click to count up attacks.)\n(SHIFT + right click to count down attacks.)\n(Middle click or hover and press SPACE to set number of attacks.)",
    requiredLocation: ["vanguard"],
    trigger: {
      status: "recognized-trigger", eventType: "unit.attacked", subject: "source",
      circles: [], targetLocation: "vanguard"
    },
    costs: [], costsReviewed: true,
    conditions: [], conditionsReviewed: true,
    choicesReviewed: true, optional: false,
    source: {
      dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09",
      patternId: "batch-ABILITY-0001-hydro-hurricane-turn-power-v1",
      review: "Exact catalog AUTO, independent of the preceding Limit Break ACT. The attacking VC instance gains 3000 for the turn on every attack against a Vanguard. Catalog UI annotations are preserved verbatim."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
  },
  {
    id: "cfa-1001:0",
    cardId: "cfa-1001",
    kind: "AUTO",
    printedText: "AUTO [RC]: During your battle phase, when this unit becomes stand, this unit gets power +3000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger", eventType: "unit.stood", subject: "source",
      circles: ["rear-guard"], requiredPhase: "battle", turnRelation: "controller"
    },
    costs: [], costsReviewed: true,
    conditions: [], conditionsReviewed: true,
    choicesReviewed: true, optional: false,
    source: {
      dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09",
      patternId: "batch-ABILITY-0001-yamatano-stand-turn-power-v1",
      review: "Exact catalog AUTO. Only this Rear-Guard becoming stand in its controller's battle phase triggers; each distinct stand event adds 3000 through turn end, without a once-per-turn restriction."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
  },
  {
    id: "cfa-1002:0",
    cardId: "cfa-1002",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: When this unit attacks a vanguard, if you have a «Nova Grappler» vanguard, this unit gets power +2000 until end of that battle.",
    source: {
      dataset: "Cardfight Area snapshot",
      patternId: "auto-own-attack-vanguard-clan-power-battle-v1",
      review: "Exact text template validated against real catalog samples; source, target circle, clan condition, and duration have regression coverage."
    },
    effects: [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]
  }
];
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;
const row = id => catalog.find(card => card.id === id);
const auth = side => side === "human" ? seats.hostAuthUid : seats.guestAuthUid;

function fixture(id, side = "human", zone) {
  const definition = definitions.find(item => item.id === id);
  const ability = Engine.parseCardAbilitiesCached(row(definition.cardId)).find(item => item.id === id);
  const other = side === "human" ? "bot" : "human";
  const owner = side === "human" ? "host-player" : "guest-player";
  const opponent = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence;
  const unit = (uid, cardId, playerId) => ({ uid, cardId, cardName: row(cardId)?.name,
    type: "Unit", unitCard: true, grade: 3, power: 10000, critical: 1,
    clan: row(cardId)?.clan, ownerPlayerId: playerId, controllerPlayerId: playerId });
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [],
    soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const source = unit(`source-${n}`, definition.cardId, owner);
  const sourceZone = zone || (id === "cfa-1001:0" ? "rear-left" : "vanguard");
  players[side].vanguard = unit(`own-vanguard-${n}`, "cfa-1002", owner);
  if (sourceZone === "vanguard") players[side].vanguard = source;
  else players[side].rear[0] = source;
  const target = unit(`opponent-vanguard-${n}`, "cfa-3", opponent);
  players[other].vanguard = target;
  source.rested = id !== "cfa-1001:0";
  const battleId = `battle-${n}`;
  const state = { matchId: "batch-ABILITY-0001", stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players, pendingAttack: { battleId, attackerUid: source.uid, attackerSide: side,
      attackerPlayerId: owner, attackerZone: sourceZone === "vanguard" ? "vanguard" : "rear-guard",
      targetUid: target.uid, targetZone: "vanguard", defenderSide: other, power: 10000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: id === "cfa-1001:0" ? "unit.stood" : "unit.attacked",
    actingPlayerId: owner, turnPlayerId: owner, sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: owner, sourceControllerPlayerId: owner, cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: owner, subjectControllerPlayerId: owner,
    attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid],
    previousLocation: sourceZone, currentLocation: sourceZone, circle: sourceZone, targetLocation: "vanguard",
    targetCardInstanceIds: [target.uid], battleId, phase: "battle", timingWindow: "attack-declared",
    before: { rested: true }, after: { rested: id !== "cfa-1001:0" } });
  return { state, source, ability, event, side, other, owner, target };
}
const discover = (f, event = f.event) => Reducer.discoverAutoTriggers(f.state, [event], Engine);
function resolve(f, changes = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth(f.side), actionId: `resolve-${++sequence}`,
    expectedStateVersion: f.state.stateVersion, payload: { accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }, ...changes }, seats, Engine);
}

test("test-only candidates preserve catalog text and ownership; the production export stays empty", () => {
  assert.deepEqual(contribution, []);
  const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === "ABILITY-0001");
  assert.equal(new Set(definitions.map(item => item.id)).size, definitions.length);
  for (const definition of definitions) {
    assert.ok(batch.abilityIds.includes(definition.id));
    const ability = Engine.parseCardAbilitiesCached(row(definition.cardId)).find(item => item.id === definition.id);
    assert.equal(ability.printedText, definition.printedText);
    assert.deepEqual(ability.definition, definition);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.once, false);
    assert.equal(Engine.isManuallyActivatable(ability), false);
  }
  assert.equal(Engine.parseCardAbilitiesCached(row("cfa-100"))[0].definition, null, "Limit Break stays unsupported");
  const report = auditCatalog(catalog);
  assert.deepEqual(report.invalidCompiled, []);
  assert.equal(report.compiled, 4174, "production audit remains at the handoff baseline");
  assert.equal(BaselineEngine.parseCardAbilitiesCached(row("cfa-100"))[1].definition, null);
  assert.equal(BaselineEngine.parseCardAbilitiesCached(row("cfa-1001"))[0].definition, null);
});

for (const id of definitions.map(item => item.id)) {
  test(`${id}: exact source resolves from both seats and replay, stale requests, and proxy decisions cannot add power`, () => {
    for (const side of ["human", "bot"]) {
      const f = fixture(id, side);
      assert.equal(discover(f).queued.length, 1);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
      assert.equal(discover(f).queued.length, 0, "same event is deduplicated");
      for (const changes of [{ actorAuthUid: auth(f.other) }, { expectedStateVersion: 0 }]) {
        const before = JSON.stringify(f.state);
        assert.equal(resolve(f, changes).ok, false);
        assert.equal(JSON.stringify(f.state), before, "invalid decision is atomic");
      }
      const result = resolve(f);
      assert.equal(result.ok, true, result.reason);
      if (id === "cfa-1002:0") {
        assert.equal(f.state.pendingAttack.power, 12000);
        assert.equal(f.source.turnPowerBoost || 0, 0);
      } else {
        assert.equal(f.source.turnPowerBoost, 3000);
        assert.equal(f.source.turnPowerExpiry, f.owner);
      }
      const before = JSON.stringify(f.state);
      assert.equal(resolve(f).ok, false);
      assert.equal(JSON.stringify(f.state), before);
    }
  });

  test(`${id}: wrong event, source instance, source circle and removed source do not resolve`, () => {
    for (const changes of [
      { type: "card.drawn" },
      { sourceCardInstanceId: "unrelated", subjectCardInstanceId: "unrelated", cardInstanceId: "unrelated",
        attackingUnitInstanceId: "unrelated", attackingCardInstanceIds: ["unrelated"] },
      { currentLocation: "guardian", circle: "guardian" }
    ]) {
      const f = fixture(id);
      const event = Engine.createGameEvent(f.state, { ...f.event, ...changes, eventId: undefined });
      assert.equal(discover(f, event).queued.length, 0, JSON.stringify(changes));
      assert.equal(f.source.turnPowerBoost || 0, 0);
    }
    const f = fixture(id);
    assert.equal(discover(f).queued.length, 1);
    const own = f.state.players[f.side];
    if (own.vanguard === f.source) own.vanguard = null;
    else own.rear[0] = null;
    own.drop.push(f.source);
    assert.equal(resolve(f).ok, false);
    assert.equal(f.source.turnPowerBoost || 0, 0);
  });
}

// TODO cases deliberately execute and fail until the primary worker adds exact
// authoritative event-context guards. They are not passing ability evidence.
for (const id of definitions.map(item => item.id)) {
  for (const [label, changes] of [
    ["controller", { sourceControllerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player" }],
    ["owner", { sourceOwnerPlayerId: "guest-player", subjectOwnerPlayerId: "guest-player" }],
    ...(id === "cfa-1001:0" ? [] : [["stale battle", { battleId: "stale-battle" }]])
  ]) {
    test(`BLOCKED ${id}: reject mismatched ${label}`, { todo: "Requires primary-owned server event-context guard; do not register candidate" }, () => {
      const f = fixture(id);
      assert.equal(discover(f, { ...f.event, ...changes }).queued.length, 0);
    });
  }
}

test("Hydro Hurricane: only VC attacks on VG trigger; turn power accumulates across battles and expires at turn end", () => {
  const rear = fixture("cfa-100:1", "human", "rear-left");
  assert.equal(discover(rear).queued.length, 0);
  const wrongTarget = fixture("cfa-100:1");
  assert.equal(discover(wrongTarget, { ...wrongTarget.event, targetLocation: "rear-left" }).queued.length, 0);
  const f = fixture("cfa-100:1");
  assert.equal(discover(f).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  f.state.pendingAttack.battleId = "second-battle";
  const event = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, battleId: "second-battle" });
  assert.equal(discover(f, event).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 6000);
  Engine.expireTurnModifiers(f.state, f.owner);
  assert.equal(f.source.turnPowerBoost, 0);
});

test("Yamatano Drake: own battle phase and RC are required, each distinct stand stacks through turn end", () => {
  for (const changes of [{ phase: "stand" }, { phase: "main" }, { turnPlayerId: "guest-player" }]) {
    const f = fixture("cfa-1001:0");
    assert.equal(discover(f, { ...f.event, ...changes }).queued.length, 0);
  }
  const vg = fixture("cfa-1001:0", "human", "vanguard");
  assert.equal(discover(vg).queued.length, 0);
  const f = fixture("cfa-1001:0");
  assert.equal(discover(f).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 3000);
  const secondStand = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined });
  assert.equal(discover(f, secondStand).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 6000);
  Engine.expireTurnModifiers(f.state, f.owner);
  assert.equal(f.source.turnPowerBoost, 0);
});

test("Hollow Nomad: both printed circles, exact clan boundary and Vanguard target", () => {
  for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-left"]) {
    const f = fixture("cfa-1002:0", side, zone);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 12000);
  }
  const wrongClan = fixture("cfa-1002:0", "human", "rear-left");
  wrongClan.state.players.human.vanguard.cardId = "cfa-100";
  wrongClan.state.players.human.vanguard.clan = "Aqua Force";
  assert.equal(discover(wrongClan).queued.length, 0);
  const wrongTarget = fixture("cfa-1002:0");
  assert.equal(discover(wrongTarget, { ...wrongTarget.event, targetLocation: "rear-left" }).queued.length, 0);
});
