"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Projection = require("./match-state-projection.js");

function fixture() {
  return {
    players: {
      human: {
        playerId: "player-host",
        hand: [{ uid: "host-hand-1", cardId: "secret-hand-card" }],
        deck: [{ uid: "host-deck-1", cardId: "secret-deck-card" }],
        gDeck: [{ uid: "host-g-1", cardId: "secret-g-card" }],
        rear: [{ uid: "public-field", cardId: "public-card" }], triggerZone: [], damage: [{ uid: "host-down", cardId: "host-secret-damage", faceDown: true }]
      },
      bot: {
        playerId: "player-guest",
        hand: [{ uid: "guest-hand-1", cardId: "other-secret-hand" }],
        deck: [{ uid: "guest-deck-1", cardId: "other-secret-deck" }],
        gDeck: [{ uid: "guest-g-1", cardId: "other-secret-g" }],
        rear: [{ uid: "public-field-2", cardId: "public-card-2" }], triggerZone: [], damage: [{ uid: "guest-up", cardId: "public-damage", faceDown: false }, { uid: "guest-down", cardId: "guest-secret-damage", faceDown: true }]
      }
    }
  };
}

test("player projection hides opponent hand, deck order, and G-deck identities while preserving counts", () => {
  const state = fixture();
  Projection.hidePrivateZones(state, ["bot"]);
  for (const zone of Projection.PRIVATE_ZONES) {
    assert.equal(state.players.bot[zone].length, 1);
    assert.equal(state.players.bot[zone][0].cardId, null);
    assert.match(state.players.bot[zone][0].uid, /^hidden-bot-/);
    assert.equal(state.players.human[zone][0].cardId.startsWith("secret"), true);
  }
  assert.equal(state.players.bot.rear[0].cardId, "public-card-2");
});

test("spectator projection hides both players' private zones and preserves face-up field cards", () => {
  const state = fixture();
  Projection.hidePrivateZones(state, ["human", "bot"]);
  for (const side of ["human", "bot"]) {
    for (const zone of Projection.PRIVATE_ZONES) assert.equal(state.players[side][zone][0].cardId, null);
    assert.notEqual(state.players[side].rear[0].cardId, null);
  }
});

test("opponent face-down gauge identities are hidden while counts and source attachments remain public", () => {
  const state = fixture();
  state.players.human.rear[0].equipGauges = [
    { uid: "host-gauge-1", cardId: "host-private-gauge", faceDown: true, attachedToInstanceId: "public-field" }
  ];
  state.players.bot.rear[0].equipGauges = [
    { uid: "guest-gauge-1", cardId: "guest-private-gauge", name: "Secret Trigger", faceDown: true, attachedToInstanceId: "public-field-2", privateNote: "must not leak" },
    { uid: "guest-gauge-2", cardId: "guest-public-gauge", name: "Face-up card", faceUp: true, attachedToInstanceId: "public-field-2" },
    { uid: "guest-gauge-3", cardId: "implicit-down-gauge", attachedToInstanceId: "public-field-2" }
  ];
  state.players.bot.equipGaugeCards = [
    { uid: "guest-unattached-gauge", cardId: "another-secret", faceDown: true }
  ];
  state.players.bot.rear[0].divineGauges = [
    { uid: "other-gauge-system", cardId: "leave-this-system-alone", faceDown: true }
  ];

  const host = Projection.projectForPlayer(state, "player-host");
  const opponentGauges = host.players.bot.rear[0].equipGauges;
  assert.equal(opponentGauges.length, 3, "the opponent's gauge count is public");
  assert.equal(opponentGauges[0].cardId, null);
  assert.equal(opponentGauges[0].name, undefined);
  assert.equal(opponentGauges[0].privateNote, undefined);
  assert.equal(opponentGauges[0].attachedToInstanceId, "public-field-2");
  assert.equal(opponentGauges[1].cardId, "guest-public-gauge", "face-up gauge identities remain public");
  assert.equal(opponentGauges[2].cardId, null, "gauge cards without an explicit face-up flag default to hidden");
  assert.equal(host.players.bot.equipGaugeCards.length, 1);
  assert.equal(host.players.bot.equipGaugeCards[0].cardId, null);
  assert.equal(host.players.bot.equipGaugeCards[0].attachedToInstanceId, undefined);
  assert.equal(host.players.bot.rear[0].divineGauges[0].cardId, "leave-this-system-alone", "the Equip Gauge projection does not change other gauge systems");
  assert.equal(host.players.human.rear[0].equipGauges[0].cardId, "host-private-gauge", "the owner retains their own gauge identity");
  assert.equal(state.players.bot.rear[0].equipGauges[0].cardId, "guest-private-gauge", "projection must not mutate canonical state");
});

test("the gauge redactor preserves face-down gauge array slots in nested field structures", () => {
  const state = fixture();
  state.players.bot.field = {
    units: [{
      uid: "target-unit",
      equipGauge: [
        { uid: "gauge-a", cardId: "secret-a", faceDown: true, attachedToInstanceId: "target-unit" },
        { uid: "gauge-b", cardId: "secret-b", faceDown: false, attachedToInstanceId: "target-unit" }
      ],
      visibleGaugeCount: 2
    }]
  };
  const view = Projection.projectForPlayer(state, "player-host");
  const unit = view.players.bot.field.units[0];
  assert.equal(unit.equipGauge.length, 2);
  assert.equal(unit.equipGauge[0].cardId, null);
  assert.equal(unit.equipGauge[0].attachedToInstanceId, "target-unit");
  assert.equal(unit.equipGauge[1].cardId, "secret-b", "explicitly face-up cards remain visible");
  assert.equal(unit.visibleGaugeCount, 2, "public gauge counts remain unchanged");
});

test("only approved private zones can be redacted and snapshot paths use the projection", () => {
  const state = fixture();
  Projection.hidePrivateZones(state, ["bot"], ["hand", "rear"]);
  assert.equal(state.players.bot.hand[0].cardId, null);
  assert.equal(state.players.bot.rear[0].cardId, "public-card-2");
  const app = fs.readFileSync("app.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(app, /hidePrivateZones\(snapshot,\s*\["bot"\]\)/);
  assert.match(app, /hidePrivateZones\(publicMatch,\s*\["human",\s*"bot"\]\)/);
  assert.match(html, /match-state-projection\.js[^\n]*defer/);
});

test("player projections redact opponent hidden damage and expose only that player's private decisions", () => {
  const state = fixture();
  state.pendingAbility = { side: "bot", triggerControllerPlayerId: "player-guest", instance: { uid: "private-source", cardId: "source" } };
  state.pendingStride = { ownerSide: "human", unitUid: "host-g-unit", costUids: ["host-hand-1"] };
  state.pendingAbilities = [
    { side: "human", instance: { uid: "host-source", cardId: "host-card" } },
    { side: "bot", instance: { uid: "guest-source", cardId: "guest-card" } }
  ];
  const host = Projection.projectForPlayer(state, "player-host");
  const guest = Projection.projectForPlayer(state, "player-guest");
  assert.equal(host.pendingAbility, null);
  assert.equal(host.pendingStride.ownerSide, "human");
  assert.deepEqual(host.pendingAbilities.map(item => item.side), ["human"]);
  assert.equal(host.players.bot.damage[0].cardId, "public-damage");
  assert.equal(host.players.bot.damage[1].cardId, null);
  assert.equal(host.players.bot.hand[0].cardId, null);
  assert.equal(host.players.human.hand[0].cardId, "secret-hand-card");
  assert.equal(guest.pendingAbility.side, "bot");
  assert.equal(guest.pendingStride, null);
  assert.deepEqual(guest.pendingAbilities.map(item => item.side), ["bot"]);
  assert.equal(guest.players.human.damage[0].cardId, null);
  assert.equal(state.pendingAbility.side, "bot");
});

test("a checked trigger remains public during its resolution while the choice stays owner-only", () => {
  const state = fixture();
  state.players.bot.triggerZone.push({ uid: "shown-check", cardId: "critical-trigger" });
  state.pendingTrigger = { side: "bot", uid: "shown-check", stage: "critical-target" };
  const host = Projection.projectForPlayer(state, "player-host");
  const guest = Projection.projectForPlayer(state, "player-guest");
  assert.equal(host.players.bot.triggerZone[0].cardId, "critical-trigger");
  assert.equal(host.pendingTrigger, null);
  assert.equal(guest.players.bot.triggerZone[0].cardId, "critical-trigger");
  assert.equal(guest.pendingTrigger.uid, "shown-check");
});

test("player projection rejects unknown player identities", () => {
  assert.equal(Projection.projectForPlayer(fixture(), "outsider"), null);
});
