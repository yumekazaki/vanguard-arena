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

test("app rerenders each bot phase change so the phase label cannot stay on Draw", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function advanceBotPhase");
  const end = app.indexOf("function botTurn", start);
  assert.ok(start >= 0 && end > start);
  assert.match(app.slice(start, end), /if\(advanced\)renderMatch\(\)/);
  assert.match(app.slice(start, end), /Practice Bot phase event failed; keeping the phase transition/);
  assert.match(app.slice(end, app.indexOf("function nextBotAttack", end)), /catch\(error\)/);
  assert.match(app.slice(start, end), /phase helper failed; applying the phase change directly/);
  assert.match(app.slice(start, end), /if\(match\.phase!==nextIndex\)\{match\.phase=nextIndex/);
});

test("bot continuation is scheduled before draw-trigger processing and drawing-phase UI rendering", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function botTurn()");
  const end = app.indexOf("function nextBotAttack", start);
  assert.ok(start >= 0 && end > start);
  const turn = app.slice(start, end);
  const schedule = turn.indexOf("botTimer = setTimeout(continueBotTurn, 750)");
  const continuation = turn.slice(turn.indexOf("const continueBotTurn = () => {"), schedule);
  const turnStart = turn.indexOf('queueTurnStartEvent("bot")');
  const draw = turn.indexOf('const card = draw("bot")');
  const render = turn.indexOf('renderMatch(); setMessage("Practice Bot is taking its turn…")');
  assert.ok(schedule >= 0 && draw > schedule && render > draw, "the bot timer must be armed before draw-trigger processing and the post-draw render");
  assert.ok(turnStart > schedule, "the bot timer must be armed before turn-start trigger processing");
  assert.match(continuation, /match!==botTurnMatch\|\|match\.ended/);
  assert.match(continuation, /match\.side!=="bot"/);
  assert.doesNotMatch(continuation, /match\.turn!==botTurnNumber/);
  assert.match(turn.slice(draw, render), /catch\s*\(error\)/, "draw-trigger failures must not strand the bot in Draw");
  assert.ok(turn.indexOf('advanceBotPhase("Ride")') < turn.indexOf("if (canGAssist(bot))"), "the bot must leave Draw before optional setup work can fail");
});

test("practice bot keeps its continuation alive while a human ability decision is pending", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function botTurn()");
  const end = app.indexOf("function nextBotAttack", start);
  const turn = app.slice(start, end);
  assert.match(turn, /const continueBotTurn = \(\) => \{/);
  assert.match(turn, /match\.pendingAbility\?\.side==="human"\|\|match\.pendingTrigger\?\.side==="human"/);
  assert.match(turn, /if\(humanDecisionPending\)\{/);
  assert.match(turn, /botTimer=setTimeout\(continueBotTurn,250\)/);
  assert.match(turn, /botTimer = setTimeout\(continueBotTurn, 750\)/);
});

test("practice bot makes a blocking human decision visible and refreshes its prompt", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function botTurn()");
  const end = app.indexOf("function nextBotAttack", start);
  const turn = app.slice(start, end);
  const wait = turn.indexOf("if(humanDecisionPending){");
  const next = turn.indexOf("try {", wait);
  assert.ok(wait >= 0 && next > wait);
  const waitBranch = turn.slice(wait, next);
  assert.match(waitBranch, /Practice Bot is waiting for you to resolve the pending ability or trigger/);
  assert.match(waitBranch, /showNextAbilityPrompt\(\)/);
  assert.match(waitBranch, /renderTriggerPrompt\(\)/);
  assert.match(waitBranch, /setTimeout\(continueBotTurn,250\)/);
});

test("bot turn advances through Draw, Ride, Stride, Main, Battle, and End; called cards get a defined circle", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const start = app.indexOf("function advanceBotPhase");
  const end = app.indexOf("function nextBotAttack", start);
  assert.ok(start >= 0 && end > start);
  const turn = app.slice(start, end);
  const schedule = turn.indexOf("botTimer = setTimeout(");
  const drawPhase = turn.indexOf('advanceBotPhase("Draw")');
  const draw = turn.indexOf('const card = draw("bot")');
  assert.ok(drawPhase >= 0, "bot enters Draw before drawing");
  assert.ok(drawPhase > schedule && drawPhase < draw, "Draw is entered after the timer is armed and before the card draw");
  let previous = turn.indexOf('if (canGAssist(bot))');
  assert.ok(turn.indexOf('advanceBotPhase("Ride")') >= 0, "bot enters Ride before optional setup work");
  for (const phase of ["Stride", "Main", "Battle"]) {
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
