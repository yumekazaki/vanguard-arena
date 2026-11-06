"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const curatedDefinitions = require("./ability-definitions.js");
const definition = curatedDefinitions.find(item => item.id === "cfa-5264:0");
const cards = loadCatalog();
const card = cards.find(item => item.id === "cfa-5264");

Engine.registerAbilityDefinitions(curatedDefinitions);

function player(playerId, vanguardName, rear = []) {
  return {
    playerId,
    vanguard: {
      uid: `${playerId}-vanguard`, cardId: "test-vanguard", cardName: vanguardName,
      ownerPlayerId: playerId, controllerPlayerId: playerId, faceUp: true
    },
    rear,
    deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [],
    crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  };
}

function dinos(playerId, uid, overrides = {}) {
  return {
    uid, cardId: "cfa-5264", cardName: "Dragon Rider, Dinos", type: "Unit", unitCard: true,
    ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left",
    faceUp: true, locked: false, isLocked: false, ...overrides
  };
}

function keywordsFor(state, uid) {
  const located = Engine.locateCardInstance(state, uid);
  assert.ok(located && !located.ambiguous, `locate unique source ${uid}`);
  return Reducer.serverGrantedContinuousKeywords(state, located, Engine);
}

test("Dragon Rider, Dinos is an exact, non-activatable RC CONT definition", () => {
  assert.ok(card);
  assert.equal(definition.id, "cfa-5264:0");
  assert.equal(definition.cardId, card.id);
  assert.equal(definition.kind, "CONT");
  assert.ok(card.text.includes(definition.printedText), "preserve exact catalog ability text");
  assert.equal(definition.source.officialCardNumber, "G-BT13/106EN");
  const ability = Engine.parseCardAbilities(card).find(item => item.id === definition.id);
  assert.ok(ability?.definition);
  assert.equal(Engine.isManuallyActivatable(ability), false);
  assert.deepEqual(ability.definition.continuousEffects, [{
    type: "grant-keyword", target: "source", keyword: "resist", duration: "continuous",
    condition: { op: "controller-vanguard-card-name-contains", name: "Thavas" }
  }]);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
});

test("each seat gets Resist only from its own Dinos instance and its own Thavas Vanguard", () => {
  const hostDinos = dinos("host", "dinos-host");
  const guestDinos = dinos("guest", "dinos-guest");
  const state = {
    side: "human",
    players: {
      human: player("host", "Supreme Ruler of the Storm, Thavas", [hostDinos, null, null, null, null]),
      bot: player("guest", "Unrelated Vanguard", [guestDinos, null, null, null, null])
    }
  };

  assert.deepEqual(keywordsFor(state, hostDinos.uid), ["resist"]);
  assert.deepEqual(keywordsFor(state, guestDinos.uid), [], "host's Thavas does not grant Resist to the guest's unit");

  state.players.human.vanguard.cardName = "Unrelated Vanguard";
  state.players.bot.vanguard.cardName = "One Who Surpasses the Storm, Thavas";
  assert.deepEqual(keywordsFor(state, hostDinos.uid), [], "grant ends when host's own Vanguard no longer matches");
  assert.deepEqual(keywordsFor(state, guestDinos.uid), ["resist"], "guest independently gains Resist from their own Thavas");
});

test("the continuous Resist grant is inactive off RC, face down, locked, or without a matching current Vanguard", () => {
  const source = dinos("host", "dinos-source");
  const state = {
    side: "human",
    players: {
      human: player("host", "Thavas Vanguard", [source, null, null, null, null]),
      bot: player("guest", "Unrelated Vanguard", [])
    }
  };

  assert.deepEqual(keywordsFor(state, source.uid), ["resist"]);
  source.controllerPlayerId = "guest";
  assert.deepEqual(keywordsFor(state, source.uid), [], "a different controller cannot borrow the host's Vanguard condition");
  source.controllerPlayerId = "host";
  state.players.human.rear[0] = null;
  state.players.human.vanguard = source;
  assert.deepEqual(keywordsFor(state, source.uid), [], "source must remain on RC");
  state.players.human.vanguard = {
    uid: "host-vanguard", cardId: "test-vanguard", cardName: "Thavas Vanguard",
    ownerPlayerId: "host", controllerPlayerId: "host", faceUp: true
  };
  state.players.human.rear[0] = source;
  source.faceUp = false;
  assert.deepEqual(keywordsFor(state, source.uid), [], "face-down source is inactive");
  source.faceUp = true;
  source.locked = true;
  assert.deepEqual(keywordsFor(state, source.uid), [], "locked source is inactive");
  source.locked = false;
  source.isLocked = false;
  state.players.human.vanguard.cardName = "Unrelated Vanguard";
  assert.deepEqual(keywordsFor(state, source.uid), [], "the other player's name cannot satisfy the condition");
});
