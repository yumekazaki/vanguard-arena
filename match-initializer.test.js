"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
const Bootstrap = require("./match-bootstrap.js");
const Initializer = require("./match-initializer.js");
const Worker = require("./supabase/functions/match-worker/worker-core.js");
const InitializerWorker = require("./supabase/functions/match-initialize/worker-core.js");

const roomCode = "0123456789ABCDEF";
const catalog = [{ id: "starter", name: "Starter Unit", grade: 0, type: "Unit", text: "" }];
for (let index = 1; index <= 9; index++) catalog.push({ id: `unit-${index}`, name: `Unit ${index}`, grade: 1, type: "Unit", text: "" });
for (let index = 1; index <= 4; index++) catalog.push({ id: `trigger-${index}`, name: `Trigger ${index}`, grade: 0, type: "Trigger", trigger: "Critical", text: "" });
for (let index = 1; index <= 5; index++) catalog.push({ id: `g-unit-${index}`, name: `G Unit ${index}`, grade: 4, type: "G Unit", text: "" });
const deck = () => ({ name: "Legal deck", starterCardId: "starter", cards: { starter: 1, ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`unit-${index + 1}`, 4])), "unit-9": 1, "trigger-1": 4, "trigger-2": 4, "trigger-3": 4, "trigger-4": 4, "g-unit-1": 1, "g-unit-2": 1, "g-unit-3": 1, "g-unit-4": 1, "g-unit-5": 1 } });
const claim = () => ({ ok: true, ready: true, roomCode, hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostDeck: deck(), guestDeck: deck() });
function deterministic() { let counter = 0; return () => `generated-${++counter}`; }

test("trusted initializer builds and commits only an authorized-seat room with both validated decks", async () => {
  const calls = [], catalogRequests = [], ids = deterministic();
  const result = await InitializerWorker.initializeRoom(roomCode, "auth-guest", {
    readRoomSeats: async () => ({ host_auth_uid: "auth-host", guest_auth_uid: "auth-guest" }),
    rpc: async (name, args) => { calls.push({ name, args }); if (name === "claim_match_decks_for_initialization") return claim(); if (name === "get_match_card_definitions") return catalog.filter(card => args.p_card_ids.includes(card.id)); if (name === "initialize_match_game_state") return { roomCode, stateVersion: 0 }; throw new Error("unexpected RPC"); },
    initializer: Initializer, bootstrap: Bootstrap, engine: Engine, validateCanonicalMatchState: Worker.validateCanonicalMatchState,
    cardDefinitions: ids => { catalogRequests.push(ids); return catalog.filter(card => ids.includes(card.id)); },
    idFactory: ids, uidFactory: ids, random: () => 0.25
  });
  assert.equal(result.ok, true);
  assert.equal(result.roomCode, roomCode);
  assert.deepEqual(calls.map(call => call.name), ["claim_match_decks_for_initialization", "initialize_match_game_state"]);
  assert.equal(catalogRequests.length, 1);
  assert.equal(new Set(catalogRequests[0]).size, catalogRequests[0].length);
  const initialized = calls[1].args.p_initial_state;
  assert.equal(initialized.stateVersion, 0);
  assert.equal(initialized.players.human.hand.length, 5);
  assert.equal(initialized.players.bot.hand.length, 5);
  assert.deepEqual(initialized.authoritySeats, { hostSide: "human", guestSide: "bot" });
  assert.equal(Object.values(initialized.players).flatMap(player => [player.vanguard, ...player.hand, ...player.deck, ...player.gDeck]).length, 110);
});

test("initializer rejects a non-seated caller before reading or locking submitted decks", async () => {
  let rpcCalls = 0;
  const result = await InitializerWorker.initializeRoom(roomCode, "attacker", {
    readRoomSeats: async () => ({ host_auth_uid: "auth-host", guest_auth_uid: "auth-guest" }),
    rpc: async () => { rpcCalls++; }, cardDefinitions: async () => catalog, initializer: Initializer, bootstrap: Bootstrap, engine: Engine
  });
  assert.deepEqual(result, { ok: false, reason: "actor-not-seated" });
  assert.equal(rpcCalls, 0);
});

test("initializer does not commit when the authorized card catalog is incomplete", async () => {
  const calls = [];
  const result = await Initializer.initializeRoom(roomCode, {
    rpc: async name => { calls.push(name); if (name === "claim_match_decks_for_initialization") return claim(); throw new Error("catalog unavailable"); },
    cardDefinitions: async () => catalog.slice(0, 1), bootstrap: Bootstrap, engine: Engine
  });
  assert.deepEqual(result, { ok: false, reason: "card-catalog-incomplete" });
  assert.deepEqual(calls, ["claim_match_decks_for_initialization"]);
});

test("initializer rejects illegal deck submissions and never writes canonical state", async () => {
  const invalid = claim(); invalid.guestDeck.cards.starter = 0;
  const calls = [];
  const result = await Initializer.initializeRoom(roomCode, {
    rpc: async (name) => { calls.push(name); if (name === "claim_match_decks_for_initialization") return invalid; if (name === "initialize_match_game_state") throw new Error("must not be called"); return catalog; },
    cardDefinitions: async ids => catalog.filter(card => ids.includes(card.id)), bootstrap: Bootstrap, engine: Engine,
    idFactory: deterministic(), uidFactory: deterministic(), random: () => 0.25
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "deck-validation-failed");
  assert.ok(!calls.includes("initialize_match_game_state"));
});

test("authority v4 keeps definitions private, requires redistribution authorization, and binds state to submitted deck counts", () => {
  const sql = fs.readFileSync("supabase/match-authority-v4.sql", "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.match_card_definitions/);
  assert.match(sql, /redistribution_authorized boolean NOT NULL DEFAULT false/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.match_card_definitions FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /auth\.role\(\).*service_role/);
  assert.match(sql, /authorized card catalog is incomplete/i);
  assert.match(sql, /match_player_state_matches_deck/);
  assert.match(sql, /authoritySeats'->>'hostSide' IS DISTINCT FROM 'human'/);
  assert.match(sql, /authoritySeats'->>'guestSide' IS DISTINCT FROM 'bot'/);
  assert.match(sql, /state does not match the seated deck submissions/i);
  assert.match(sql, /locked_for_match = true/);
});
