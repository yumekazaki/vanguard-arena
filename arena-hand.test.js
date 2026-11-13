"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    toggle(value, force) {
      const next = force === undefined ? !values.has(value) : Boolean(force);
      if (next) values.add(value); else values.delete(value);
      return next;
    },
  };
}
function makeElement({ classes = [], width = 800 } = {}) {
  return {
    classList: makeClassList(classes), dataset: {}, style: { setProperty() {} },
    attributes: {}, listeners: {}, hidden: true, inert: false, parentElement: { clientWidth: width },
    textContent: "", innerHTML: "", addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    append() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, getClientRects() { return [1]; },
  };
}
function boot({ saved = null } = {}) {
  const cards = makeElement(), drawer = makeElement(), opener = makeElement(), closer = makeElement();
  const scrim = makeElement(), playView = makeElement(), matchLayout = makeElement({ classes: ["hidden"] });
  const matchEmpty = makeElement(), done = makeElement(), hint = makeElement();
  hint.textContent = "Select a card for its usual actions.";
  drawer.querySelector = selector => selector === ".hand-fan-hint" ? hint : null;
  const count = makeElement();
  const selectors = {
    "#hand-drawer": drawer, "#hand-cards": cards, "#open-hand": opener,
    "#close-hand": closer, "#hand-scrim": scrim, "#view-play": playView,
    "#match-layout": matchLayout, "#match-empty": matchEmpty,
    "#hand-done-guarding": done, "#hand-button-count": count,
  };
  const observers = [];
  class MutationObserver { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} }
  class ResizeObserver { constructor(callback) { this.callback = callback; } observe() {} }
  const body = makeElement();
  const store = new Map();
  if (saved !== null) store.set("vanguard-hand-tray-expanded", saved);
  const dispatched = [];
  const context = {
    document: { body, activeElement: null, querySelector: selector => selectors[selector] || null, dispatchEvent: event => dispatched.push(event) },
    window: {},
    localStorage: { getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, value) },
    MutationObserver, ResizeObserver, requestAnimationFrame: callback => { callback(); return 1; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    clearTimeout() {}, console,
  };
  vm.runInNewContext(fs.readFileSync("arena-hand.js", "utf8"), context);
  return { context, drawer, opener, scrim, done, playView, matchLayout, matchEmpty, observers, store, body, cards, dispatched };
}
function enterMatch(ui) {
  ui.playView.classList.add("active-view");
  ui.matchLayout.classList.remove("hidden");
  ui.matchEmpty.classList.add("hidden");
  ui.observers.forEach(observer => observer.callback());
}

test("hand stays present in matches and its expanded preference survives actions", () => {
  const ui = boot();
  enterMatch(ui);
  assert.equal(ui.drawer.hidden, false);
  assert.equal(ui.drawer.classList.contains("is-persistent"), true);
  assert.equal(ui.drawer.classList.contains("is-expanded"), true);
  ui.opener.listeners.click();
  assert.equal(ui.drawer.hidden, false);
  assert.equal(ui.drawer.classList.contains("is-collapsed"), true);
  assert.equal(ui.scrim.hidden, true);
  assert.equal(ui.body.classList.contains("hand-menu-open"), false);
  assert.equal(ui.store.get("vanguard-hand-tray-expanded"), "false");
  ui.opener.listeners.click();
  assert.equal(ui.drawer.classList.contains("is-expanded"), true);
  ui.context.window.VanguardHand.close(false);
  assert.equal(ui.drawer.classList.contains("is-expanded"), true);
});
test("guarding can open its modal without losing the persistent hand tray", () => {
  const ui = boot({ saved: "false" });
  enterMatch(ui);
  ui.context.window.VanguardHand.syncDefense({ active: true, canFinish: true });
  ui.context.window.VanguardHand.open({ guarding: true });
  assert.equal(ui.drawer.classList.contains("is-modal"), true);
  assert.equal(ui.scrim.hidden, false);
  assert.equal(ui.body.classList.contains("hand-menu-open"), true);
  assert.equal(ui.done.hidden, false);
  ui.context.window.VanguardHand.syncDefense({ active: false, canFinish: false });
  assert.equal(ui.drawer.hidden, false);
  assert.equal(ui.drawer.classList.contains("is-modal"), false);
  assert.equal(ui.scrim.hidden, true);
  assert.equal(ui.drawer.classList.contains("is-collapsed"), true);
});


test("desktop hand drag identifies a circle and dispatches the same ride/call action request", () => {
  const ui = boot();
  enterMatch(ui);
  const card = makeElement();
  card.dataset.handUid = "hand-unit-1";
  let storedUid = "";
  const transfer = {
    effectAllowed: "",
    types: ["text/plain"],
    setData(_type, value) { storedUid = value; },
    getData() { return storedUid; },
  };
  ui.cards.listeners.dragstart({ target: { closest: selector => selector === "[data-hand-uid]" ? card : null }, dataTransfer: transfer });
  assert.equal(storedUid, "hand-unit-1");
  assert.equal(transfer.effectAllowed, "move");
  const zone = makeElement();
  zone.dataset.zone = "rear-left";
  let allowed = false;
  ui.matchLayout.listeners.dragover({
    target: { closest: () => zone }, dataTransfer: transfer,
    preventDefault() { allowed = true; },
  });
  assert.equal(allowed, true);
  ui.matchLayout.listeners.drop({
    target: { closest: () => zone }, dataTransfer: transfer,
    preventDefault() {},
  });
  assert.equal(ui.dispatched.length, 1);
  assert.equal(ui.dispatched[0].type, "arena:place-from-hand");
  assert.equal(ui.dispatched[0].detail.uid, "hand-unit-1");
  assert.equal(ui.dispatched[0].detail.zone, "rear-left");
});
