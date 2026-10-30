"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const PATTERN = "cont-no-ride-normal-call-requires-dragontree-marker-v1";
const IDS = ["cfa-11916", "cfa-11951", "cfa-11956", "cfa-12032", "cfa-12058"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("five real CONT abilities preserve the no-ride and marker-gated normal call restriction", () => {
  const found = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  assert.deepEqual(found.map(ability => ability.id).sort(), IDS.map(id => `${id}:0`).sort());
  for (const ability of found) {
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.definition.keywords, ["cannot-be-ridden"]);
    assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "normal-call-requires-dragontree-marker" }]);
    assert.equal(ability.printedText, "CONT: This card cannot be ridden, and cannot be normal called to RC without any Dragontree markers.");
    assert.equal(Engine.canRideCard({ id: ability.cardId }), false, `${ability.id} cannot be ridden`);
  }
});

test("normal call is blocked without the controller's Rear-Guard marker and allowed with one", () => {
  for (const id of IDS) {
    const card = catalog.find(value => value.id === id);
    assert.equal(Engine.canCallCard(card, { dragontreeMarkerCount: 0 }), false, `${id} no marker`);
    assert.equal(Engine.canCallCard(card, { dragontreeMarkerCount: 1 }), true, `${id} own marker`);
    assert.equal(Engine.canCallCard(card, {}), false, `${id} missing state fails closed`);
  }
});

function callFixture(side, cardId, marker = false) {
  const card = catalog.find(value => value.id === cardId), ownerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, unitCard: true, grade: Number(card.grade), ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const vanguard = { uid: `vg-${side}`, cardId: "test-vg", cardName: "Test Vanguard", unitCard: true, grade: 3, power: 13000, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const enemyVanguard = { uid: `enemy-vg-${side}`, cardId: "enemy-vg", cardName: "Enemy Vanguard", unitCard: true, grade: 3, power: 13000, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  const player = (playerId, vg, hand = [], rear = [], giftZones = []) => ({ playerId, vanguard: vg, hand, rear, giftZones, deck: [], drop: [], soul: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const state = { matchId: `call-restrict-${side}-${cardId}-${marker}`, stateVersion: 0, turn: 2, side, phase: 4, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, players: { [side]: player(ownerId, vanguard, [source], [null, null, null, null, null], marker ? [{ type: "Dragontree", zone: "rear-left" }] : []), [otherSide]: player(opponentId, enemyVanguard) } };
  const command = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `call-${state.matchId}`, expectedStateVersion: 0, payload: { type: "game-action", action: "call", cardInstanceId: source.uid, rearIndex: 0 } };
  return { card, source, state, command, side };
}

test("authoritative normal calls reject atomically without a marker and succeed for both online seats with one", () => {
  for (const side of ["human", "bot"]) for (const cardId of IDS) {
    const blocked = callFixture(side, cardId, false), denied = Reducer.applyGameAction(blocked.state, blocked.command, seats, Engine);
    assert.equal(denied.ok, false, `${side}/${cardId} must be denied`);
    assert.equal(denied.reason, "normal-call-requires-dragontree-marker");
    assert.equal(blocked.state.players[side].hand[0].uid, blocked.source.uid, "denied call leaves hand unchanged");
    assert.equal(blocked.state.players[side].rear[0], null, "denied call leaves circle unchanged");

    const legal = callFixture(side, cardId, true), accepted = Reducer.applyGameAction(legal.state, legal.command, seats, Engine);
    assert.equal(accepted.ok, true, `${side}/${cardId}: ${accepted.reason}`);
    assert.equal(legal.state.players[side].rear[0].uid, legal.source.uid);
    assert.equal(legal.state.players[side].hand.length, 0);
  }
});

test("hand menu and selection flow hide or explain the illegal normal call", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /canCallCard\(card,\{dragontreeMarkerCount:/);
  assert.match(app, /This unit can only be normal called while you have a Dragontree marker on a Rear-Guard Circle/);
});
