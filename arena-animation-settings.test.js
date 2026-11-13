"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function boot(saved = null) {
  const store = new Map();
  if (saved !== null) store.set("vanguard-animation-speed", saved);
  const select = { value: "", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const root = { dataset: {} };
  const context = {
    window: { localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } },
    document: { documentElement: root, getElementById: id => id === "animation-speed" ? select : null },
  };
  vm.runInNewContext(fs.readFileSync("arena-animation-settings.js", "utf8"), context);
  return { settings: context.window.VanguardAnimationSettings, root, select, store };
}

test("animation preference defaults to normal and restores a saved mode", () => {
  assert.equal(boot().root.dataset.animationSpeed, "normal");
  assert.equal(boot("fast").select.value, "fast");
  assert.equal(boot("reduced").settings.getMode(), "reduced");
});

test("fast mode shortens visual timing while reduced mode keeps reveal readability", () => {
  const ui = boot();
  assert.equal(ui.settings.duration(1650), 1650);
  ui.select.value = "fast";
  ui.select.listeners.change({ currentTarget: ui.select });
  assert.equal(ui.settings.duration(1650), 908);
  assert.equal(ui.store.get("vanguard-animation-speed"), "fast");
  ui.settings.setMode("reduced");
  assert.equal(ui.settings.duration(1650), 1650);
});

test("invalid stored and selected values safely fall back to normal", () => {
  const ui = boot("extreme");
  assert.equal(ui.settings.getMode(), "normal");
  assert.equal(ui.settings.setMode("unknown"), "normal");
});
