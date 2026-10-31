"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");

function fixture() {
  const source = { uid: "source-instance", cardId: "cfa-source", ownerPlayerId: "owner-a", controllerPlayerId: "controller-a" };
  const subject = { uid: "subject-instance", cardId: "cfa-subject", ownerPlayerId: "owner-b", controllerPlayerId: "controller-b" };
  const state = {
    matchId: "event-identity-test",
    eventSequence: 0,
    players: {
      first: { playerId: "controller-a", vanguard: source, rear: [] },
      second: { playerId: "controller-b", vanguard: subject, rear: [] }
    }
  };
  return { state, source, subject };
}

test("game-event snapshots fill source and subject owner/controller from their exact instances", () => {
  const { state, source, subject } = fixture();
  const event = Engine.createGameEvent(state, {
    type: "attack.declared",
    actingPlayerId: "controller-a",
    turnPlayerId: "controller-a",
    sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: null,
    sourceControllerPlayerId: null,
    cardInstanceId: subject.uid,
    subjectOwnerPlayerId: null,
    subjectControllerPlayerId: null
  });

  assert.equal(event.subjectCardInstanceId, subject.uid);
  assert.equal(event.sourceOwnerPlayerId, source.ownerPlayerId);
  assert.equal(event.sourceControllerPlayerId, source.controllerPlayerId);
  assert.equal(event.subjectOwnerPlayerId, subject.ownerPlayerId);
  assert.equal(event.subjectControllerPlayerId, subject.controllerPlayerId);
});

test("game-event snapshots preserve explicitly contradictory identity for the authoritative reducer to reject", () => {
  const { state, source, subject } = fixture();
  const event = Engine.createGameEvent(state, {
    type: "attack.declared",
    actingPlayerId: "controller-a",
    turnPlayerId: "controller-a",
    sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: "forged-owner",
    sourceControllerPlayerId: "forged-controller",
    subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: "forged-subject-owner",
    subjectControllerPlayerId: "forged-subject-controller"
  });

  assert.equal(event.sourceOwnerPlayerId, "forged-owner");
  assert.equal(event.sourceControllerPlayerId, "forged-controller");
  assert.equal(event.subjectOwnerPlayerId, "forged-subject-owner");
  assert.equal(event.subjectControllerPlayerId, "forged-subject-controller");
});
