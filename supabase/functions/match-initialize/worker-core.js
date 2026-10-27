"use strict";

(function attachInitializerWorker(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchInitializerWorker = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createInitializerWorker() {
  async function initializeRoom(roomCode, authUid, dependencies = {}) {
    if (typeof authUid !== "string" || !authUid) return { ok: false, reason: "authentication-required" };
    const { rpc, readRoomSeats, initializer, cardDefinitions, bootstrap, engine, validateCanonicalMatchState } = dependencies;
    if (typeof rpc !== "function" || typeof readRoomSeats !== "function" || typeof cardDefinitions !== "function" || !initializer?.initializeRoom) return { ok: false, reason: "initializer-not-configured" };
    let roomSeats;
    try { roomSeats = await readRoomSeats(roomCode); } catch { return { ok: false, reason: "room-not-found" }; }
    if (!roomSeats || ![roomSeats.host_auth_uid, roomSeats.guest_auth_uid].includes(authUid)) return { ok: false, reason: "actor-not-seated" };
    return initializer.initializeRoom(roomCode, { rpc, cardDefinitions, bootstrap, engine, validateCanonicalMatchState });
  }

  return Object.freeze({ initializeRoom });
});
