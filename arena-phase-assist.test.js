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
test("safe automatic progression is the default and manual mode is remembered", () => {
  const ui = boot();
  assert.equal(ui.assist.getMode(), "assisted");
  assert.equal(ui.assist.shouldAdvance(safeStand), true);
  ui.select.value = "manual";
  ui.select.listeners.change({ currentTarget: ui.select });
  assert.equal(ui.store.get("vanguard-phase-progression"), "manual");
  assert.equal(ui.assist.shouldAdvance(safeStand), false);
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

test("Ride and Stride auto-continue only when no legal choice exists", () => {
  const assist = boot("assisted").assist;
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 2, canRide: false }), true);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 2, canRide: true }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 3, canStride: false }), true);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 3, canStride: true }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 2, canRide: false, pendingDecision: true }), false);
});

test("Main and Battle stay player-controlled; End only passes when explicitly safe", () => {
  const assist = boot("assisted").assist;
  for (const phase of [4, 5]) assert.equal(assist.shouldAdvance({ ...safeStand, phase }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 6 }), false);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 6, safeToEndTurn: true }), true);
  assert.equal(assist.shouldAdvance({ ...safeStand, phase: 6, safeToEndTurn: true, hasLegalDecision: true }), false);
});
