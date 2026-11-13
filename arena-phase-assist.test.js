"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function boot(saved = null) {
  const store = new Map();
  if (saved !== null) store.set("vanguard-phase-progression", saved);
  const select = { value: "", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const root = { dataset: {} };
  const context = {
    window: { localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } },
    document: { documentElement: root, getElementById: id => id === "phase-progression" ? select : null },
  };
  vm.runInNewContext(fs.readFileSync("arena-phase-assist.js", "utf8"), context);
  return { assist: context.window.VanguardPhaseAssist, select, root, store };
}

const safeStand = { side: "human", isLocalTurn: true, phase: 0, ended: false, pendingDecision: false, hasLegalDecision: false };
test("phase assistance is opt-in and remembers the player's selection", () => {
  const ui = boot();
  assert.equal(ui.assist.getMode(), "manual");
  assert.equal(ui.assist.shouldAdvance(safeStand), false);
  ui.select.value = "assisted";
  ui.select.listeners.change({ currentTarget: ui.select });
  assert.equal(ui.store.get("vanguard-phase-progression"), "assisted");
  assert.equal(ui.assist.shouldAdvance(safeStand), true);
});

test("assisted progression waits for every pending prompt and legal player choice", () => {
  const assist = boot("assisted").assist;
  assert.equal(assist.shouldAdvance({ ...safeStand, pendingDecision: true }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, hasLegalDecision: true }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, side: "bot" }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, isLocalTurn: false }), false);
});

test("Draw may auto-advance only after its draw when G Assist and skills are unavailable", () => {
  const assist = boot("assisted").assist;
  const draw = { ...safeStand, phase: 1, drewThisTurn: true, canGAssist: false };
  assert.equal(assist.shouldAdvance(draw), true);
  assert.equal(assist.shouldAdvance({ ...draw, drewThisTurn: false }), false);
  assert.equal(assist.shouldAdvance({ ...draw, canGAssist: true }), false);
  assert.equal(assist.shouldAdvance({ ...draw, hasLegalDecision: true }), false);
});

test("Riding, Striding, Main, Battle, and End always remain player-controlled", () => {
  const assist = boot("assisted").assist;
  for (const phase of [2, 3, 4, 5, 6]) assert.equal(assist.shouldAdvance({ ...safeStand, phase, drewThisTurn: true }), false);
});
