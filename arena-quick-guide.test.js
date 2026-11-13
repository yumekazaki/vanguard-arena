"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function boot() {
  const context = { window: {}, document: { getElementById: () => null } };
  vm.runInNewContext(fs.readFileSync("arena-quick-guide.js", "utf8"), context);
  return context.window.VanguardQuickGuide;
}

test("quick tour covers hand, phase, battle, and zone controls", () => {
  const guide = boot();
  assert.equal(guide.count, 4);
  assert.match(guide.stepAt(0).copy, /hand/i);
  assert.match(guide.stepAt(1).copy, /phase/i);
  assert.match(guide.stepAt(2).copy, /guard/i);
  assert.match(guide.stepAt(3).copy, /face-down/i);
});

test("quick tour navigation clamps invalid step indexes", () => {
  const guide = boot();
  assert.equal(guide.normalizeIndex(-8), 0);
  assert.equal(guide.normalizeIndex(40), guide.count - 1);
  assert.equal(guide.normalizeIndex("2"), 2);
  assert.equal(guide.normalizeIndex("invalid"), 0);
});
