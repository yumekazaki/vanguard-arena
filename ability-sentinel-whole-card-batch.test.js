"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const Bootstrap = require("./match-bootstrap.js");
const Reducer = require("./ability-server-reducer.js");

const CARD_IDS = [
  "cfa-11867", "cfa-12137", "cfa-12725", "cfa-7450", "cfa-7452", "cfa-7454", "cfa-7616", "cfa-7618", "cfa-7619",
  "cfa-7630", "cfa-7776", "cfa-7778", "cfa-7782", "cfa-7784", "cfa-7852", "cfa-7859", "cfa-7863", "cfa-7866",
  "cfa-7919", "cfa-7928", "cfa-7933", "cfa-7934", "cfa-8034", "cfa-8035", "cfa-8042", "cfa-8044", "cfa-8116"
];
const SENTINEL_PATTERN = "cont-sentinel-keyword-v1";

test("27 single-skill Sentinel Critical Triggers have complete card and passive-keyword definitions", () => {
  const catalog = loadCatalog();
  assert.equal(new Set(CARD_IDS).size, CARD_IDS.length);

  for (const cardId of CARD_IDS) {
    const card = catalog.find(row => row.id === cardId);
    assert.ok(card, `${cardId} exists in the imported catalog`);
    assert.equal(card.type, "Trigger", cardId);
    assert.equal(Number(card.grade), 0, cardId);
    assert.equal(String(card.trigger).toLowerCase(), "critical", cardId);
    assert.equal(Number(card.shield), 30000, cardId);
    const abilities = Engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, 1, `${cardId} has no unmodeled second skill`);
    const [ability] = abilities;
    assert.equal(ability.printedText, "CONT: Sentinel.", cardId);
    assert.equal(ability.kind, "CONT", cardId);
    assert.equal(ability.definition?.source?.patternId, SENTINEL_PATTERN, cardId);
    assert.deepEqual(ability.definition?.keywords, ["sentinel"], cardId);
    assert.equal(ability.definition?.effects, undefined, cardId);
    assert.equal(ability.trigger, null, cardId);
    assert.equal(Engine.hasAbilityKeyword([ability], "sentinel"), true, cardId);
    assert.equal(Engine.isManuallyActivatable(ability), false, cardId);
    assert.equal(Engine.autoAbilityReadiness(ability).reason, "not-automatic", cardId);
  }
});

test("each verified Sentinel trigger enters both player decks as a Sentinel and guards through the authoritative reducer", () => {
  const catalog = loadCatalog();
  const byId = new Map(catalog.map(card => [String(card.id), card]));
  const nonSentinelTriggers = catalog.filter(card => card.trigger && !/^(?:heal|over)$/i.test(card.trigger) && !Engine.hasAbilityKeyword(card, "sentinel"));
  const nonTriggerUnits = catalog.filter(card => /unit/i.test(String(card.type || "")) && !card.trigger && !/g unit|g guardian|g-guard/i.test(`${card.type || ""} ${card.name || ""}`));
  const nameKey = card => String(card.name || card.id).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
  const uniqueByName = cards => [...new Map(cards.map(card => [nameKey(card), card])).values()];
  const sentinelTriggers = uniqueByName(catalog.filter(card => card.trigger && Engine.hasAbilityKeyword(card, "sentinel")));
  const triggerFillers = uniqueByName(nonSentinelTriggers);
  const unitFillers = uniqueByName(nonTriggerUnits).filter(card => !Engine.hasAbilityKeyword(card, "sentinel"));
  assert.ok(sentinelTriggers.length >= 5);
  assert.ok(triggerFillers.length >= 16);
  assert.ok(unitFillers.length >= 34);
  const starter = unitFillers.find(card => Number(card.grade) === 0);
  assert.ok(starter, "a grade-zero normal unit is available for the test deck");
  const playerDeck = sentinelCardIds => {
    const sentinelIds = new Set(sentinelCardIds.map(String));
    const sentinels = sentinelCardIds.map(cardId => byId.get(String(cardId)));
    const chosenTriggers = triggerFillers.filter(card => !sentinelIds.has(String(card.id))).slice(0, 16 - sentinelIds.size);
    const triggerNames = new Set([...sentinels, ...chosenTriggers].map(nameKey));
    const units = [starter, ...unitFillers.filter(card => card.id !== starter.id && !sentinelIds.has(String(card.id)) && !triggerNames.has(nameKey(card)))].slice(0, 34);
    assert.equal(units.length, 34);
    const cards = Object.fromEntries([...sentinels.map(card => [String(card.id), 1]), ...chosenTriggers.map(card => [String(card.id), 1]), ...units.map(card => [String(card.id), 1])]);
    assert.equal(Object.values(cards).reduce((sum, count) => sum + count, 0), 50);
    return { name: "Sentinel regression", format: "premium", starterCardId: starter.id, cards };
  };
  const fourSentinelDeck = playerDeck(sentinelTriggers.slice(0, 4).map(card => card.id));
  assert.equal(Bootstrap.validateDecklist(fourSentinelDeck, cardId => byId.get(String(cardId)), Engine).ok, true, "four Sentinels are permitted");
  const fiveSentinelDeck = playerDeck(sentinelTriggers.slice(0, 5).map(card => card.id));
  assert.deepEqual(Bootstrap.validateDecklist(fiveSentinelDeck, cardId => byId.get(String(cardId)), Engine), {
    ok: false, reason: "deck-restriction-exceeded", heals: 0, overs: 0, sentinels: 5, regalis: 0
  }, "a fifth Sentinel is rejected by the actual deck validator");
  let id = 0;
  for (const sentinelCardId of CARD_IDS) {
    const deck = playerDeck([sentinelCardId]);
    const created = Bootstrap.createInitialMatchState({
      hostDeck: deck, guestDeck: deck,
      hostAuthUid: "auth-host", guestAuthUid: "auth-guest",
      cardById: cardId => byId.get(String(cardId)), engine: Engine,
      idFactory: () => `sentinel-test-id-${++id}`,
      uidFactory: () => `sentinel-test-card-${++id}`, random: () => 0.37
    });
    assert.equal(created.ok, true, `${sentinelCardId}: ${created.reason || ""}`);
    const state = created.state;
    state.phase = 5;
    state.firstTurnComplete = true;
    state.preMatch.stage = "play";
    for (const defenderSide of ["human", "bot"]) {
      const defender = state.players[defenderSide];
      const attackerSide = defenderSide === "human" ? "bot" : "human";
      const attacker = state.players[attackerSide];
      const sentinel = [...defender.hand, ...defender.deck].find(card => card.cardId === sentinelCardId);
      assert.ok(sentinel, `${sentinelCardId}:${defenderSide} is in a playable zone`);
      assert.equal(sentinel.sentinel, true, `${sentinelCardId}:${defenderSide} retains its keyword on the card instance`);
      defender.hand = defender.hand.filter(card => card.uid !== sentinel.uid);
      defender.deck = defender.deck.filter(card => card.uid !== sentinel.uid);
      defender.hand.push(sentinel);
      const payment = defender.hand.find(card => card.uid !== sentinel.uid);
      assert.ok(payment, `${sentinelCardId}:${defenderSide} has an unrelated card available`);
      const attackerUid = attacker.vanguard.uid;
      state.side = attackerSide;
      state.pendingAttack = {
        battleId: `${sentinelCardId}-${defenderSide}`, attackerSide, attackerUid,
        attackerZone: "vanguard", defenderSide, targetUid: defender.vanguard.uid,
        targetZone: "vanguard", power: 30000, targetPower: 13000,
        critical: 1, guardCards: [], defenderDone: false, maxDriveChecks: 10, driveCountChosen: false
      };
      const authUid = defenderSide === "human" ? "auth-host" : "auth-guest";
      const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
      const result = Reducer.applyGameAction(state, {
        actorAuthUid: authUid, actionId: `guard-${sentinelCardId}-${defenderSide}`,
        expectedStateVersion: state.stateVersion,
        payload: { type: "game-action", action: "guard", cardInstanceId: sentinel.uid }
      }, seats, Engine);
      assert.equal(result.ok, true, `${sentinelCardId}:${defenderSide}: ${result.reason || ""}`);
      assert.ok(defender.guardCircle.some(card => card.uid === sentinel.uid), `${sentinelCardId}:${defenderSide} is guarded by its controller`);
      assert.equal(state.pendingAttack.targetPower, 43000, `${sentinelCardId}:${defenderSide} applies its printed shield`);
      assert.ok(defender.hand.some(card => card.uid === payment.uid), `${sentinelCardId}:${defenderSide} pays no unprinted cost`);
      assert.equal(attacker.drop.length, 0, `${sentinelCardId}:${defenderSide} cannot charge the opponent for guarding`);
      state.pendingAttack = null;
    }
  }
});
