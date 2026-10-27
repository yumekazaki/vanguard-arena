"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const PracticeBot = require("./practice-bot.js");

test("practice bot maps every Rear-Guard array slot to its actual circle", () => {
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => PracticeBot.rearGuardCircleForSlot(index)), [
    "rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", "accel-1", "accel-2"
  ]);
  assert.equal(PracticeBot.rearGuardCircleForSlot(-1), null);
  assert.equal(PracticeBot.rearGuardCircleForSlot(1.5), null);
});

test("practice bot phase updates are applied and emit one transition event", () => {
  const match = { side: "bot", phase: 1 };
  const transitions = [];
  const phases = ["Stand", "Draw", "Ride", "Stride", "Main", "Battle", "End"];
  assert.equal(PracticeBot.advancePhase(match, "Ride", phases, (...args) => transitions.push(args)), true);
  assert.equal(match.phase, 2);
  assert.deepEqual(transitions, [["bot", "Draw", "Ride"]]);
  assert.equal(PracticeBot.advancePhase(match, "Ride", phases, (...args) => transitions.push(args)), true);
  assert.equal(transitions.length, 1);
  assert.equal(PracticeBot.advancePhase(match, "invalid", phases), false);
  assert.equal(match.phase, 2);
});

test("bot turn advances through Draw, Ride, Stride, Main, Battle, and End; called cards get a defined circle", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function advanceBotPhase");
  const end = app.indexOf("function nextBotAttack", start);
  assert.ok(start >= 0 && end > start);
  const turn = app.slice(start, end);
  let previous = -1;
  for (const phase of ["Draw", "Ride", "Stride", "Main", "Battle"]) {
    const index = turn.indexOf(`advanceBotPhase(\"${phase}\")`);
    assert.ok(index > previous, `bot phase ${phase} advances in order`);
    previous = index;
  }
  const finishStart = app.indexOf("function finishBotTurn");
  const finishEnd = app.indexOf("function retireChargingUnitsAtBattleEnd", finishStart);
  assert.ok(finishStart >= 0 && finishEnd > finishStart);
  assert.match(app.slice(finishStart, finishEnd), /advanceBotPhase\("End"\)/);
  assert.match(turn, /const zone=window\.VanguardPracticeBot\.rearGuardCircleForSlot\(slot\)/);
  assert.match(turn, /queueAbilityPrompts\("place","bot",unit\.uid,\{source:"hand",zone\}\)/);
});
