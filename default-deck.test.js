const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
const preferenceCode = app.slice(app.indexOf("  function deckStorageKey()"), app.indexOf("  function updateDeckCount()"));
const empty = () => ({ id: null, name: "Untitled deck", cards: {}, starterCardId: "" });
const deck = (id, name = id) => ({ id, name, cards: { "cfa-664": 4 }, starterCardId: "cfa-641" });
function session(storage = new Map()) {
  const context = {
    account: { user: null }, localDeckStorageKey: "vanguardArenaDecks", builder: empty(), match: null,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    renderBuilder() {}, renderSavedDecks() {}, updateDeckCount() {}, persistCloudDecks() {}, toast() {}
  };
  vm.createContext(context);
  vm.runInContext(preferenceCode, context);
  return context;
}
function save(storage, decks, user = "") {
  storage.set("vanguardArenaDecks" + (user ? ":" + user : ""), JSON.stringify(decks));
}

test("chosen default loads immediately and restores a detached deck on a new visit", () => {
  const storage = new Map(); save(storage, [deck("one"), deck("two")]);
  const first = session(storage); first.makeDefaultDeck("two");
  assert.equal(first.builder.id, "two");
  assert.equal(first.savedDefaultDeck().id, "two");
  first.builder.cards["cfa-664"] = 1;
  const next = session(storage); next.restoreDefaultDeck();
  assert.equal(next.builder.id, "two");
  assert.equal(next.builder.cards["cfa-664"], 4);
  assert.equal(next.builder.starterCardId, "cfa-641");
});

test("changing default replaces the single preference without changing saved deck data", () => {
  const storage = new Map(); save(storage, [deck("one"), deck("two")]);
  const original = storage.get("vanguardArenaDecks");
  const context = session(storage);
  context.makeDefaultDeck("one"); context.makeDefaultDeck("two");
  assert.equal(context.savedDefaultDeck().id, "two");
  assert.equal(storage.get("vanguardArenaDecks"), original);
});

test("account folders have separate defaults and late account decks can restore", () => {
  const storage = new Map(); save(storage, [deck("local")]); save(storage, [deck("account")], "alice");
  const first = session(storage); first.makeDefaultDeck("local");
  first.account.user = { id: "alice" }; first.makeDefaultDeck("account");
  // Simulate account decks arriving after the session is restored.
  storage.delete("vanguardArenaDecks:alice");
  const next = session(storage); next.restoreDefaultDeck();
  assert.equal(next.builder.id, "local");
  next.account.user = { id: "alice" }; next.restoreDefaultDeck();
  assert.equal(next.builder.id, "local");
  save(storage, [deck("account")], "alice"); next.restoreDefaultDeck();
  assert.equal(next.builder.id, "account");
  next.account.user = { id: "bob" };
  assert.equal(next.savedDefaultDeck(), null);
});

test("late sync never replaces edits or an active match, and restoration happens once", () => {
  const storage = new Map(); save(storage, [deck("one")]);
  session(storage).makeDefaultDeck("one");
  const editing = session(storage); editing.builder.name = "Work in progress"; editing.restoreDefaultDeck();
  assert.equal(editing.builder.name, "Work in progress");
  const playing = session(storage); playing.match = {}; playing.restoreDefaultDeck();
  assert.equal(playing.builder.id, null);
  const restored = session(storage); restored.restoreDefaultDeck();
  restored.builder = empty(); restored.restoreDefaultDeck();
  assert.equal(restored.builder.id, null);
});

test("missing or deleted defaults safely leave the workshop empty", () => {
  const storage = new Map(); save(storage, [deck("one")]);
  const context = session(storage); context.makeDefaultDeck("one");
  save(storage, []);
  const next = session(storage); next.restoreDefaultDeck();
  assert.equal(next.savedDefaultDeck(), null);
  assert.equal(next.builder.id, null);
  next.makeDefaultDeck("missing");
  assert.equal(next.builder.id, null);
});
