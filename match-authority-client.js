"use strict";

(function attachMatchAuthorityClient(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchAuthorityClient = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchAuthorityClient() {
  const RESERVED_PAYLOAD_KEYS = new Set(["actorPlayerId", "actorAuthUid", "matchId", "expectedStateVersion", "actionId"]);

  function validateCommandInput(client, input) {
    if (!client || typeof client.rpc !== "function" || !client.functions || typeof client.functions.invoke !== "function") {
      throw new TypeError("An authenticated Supabase client is required");
    }
    if (!input || typeof input !== "object" || !/^[A-Fa-f0-9]{16}$/.test(input.roomCode || "")) {
      throw new TypeError("A valid match room code is required");
    }
    if (typeof input.actionId !== "string" || !input.actionId || input.actionId.length > 180) {
      throw new TypeError("A valid action ID is required");
    }
    if (!Number.isSafeInteger(input.expectedStateVersion) || input.expectedStateVersion < 0) {
      throw new TypeError("A valid expected state version is required");
    }
    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new TypeError("A structured action payload is required");
    }
    if (Object.keys(input.payload).some(key => RESERVED_PAYLOAD_KEYS.has(key))) {
      throw new TypeError("Actor, match, action, and version fields are assigned by the trusted command boundary");
    }
  }

  const GAME_ACTION_FIELDS = Object.freeze({
    draw: [], ride: ["cardInstanceId"], call: ["cardInstanceId", "rearIndex"],
    stride: ["strideCardInstanceId", "costCardInstanceIds"],
    attack: ["attackerCardInstanceId", "targetCardInstanceId", "boosterCardInstanceId"],
    guard: ["cardInstanceId", "discardCardInstanceId"], noGuard: [],
    driveCount: ["count"], driveCheck: [], triggerChoice: ["targetCardInstanceId"],
    resolveBattle: [], damageCheck: [], advance: [], endTurn: [],
    setupRoll: [], setupChoice: ["firstSide"], setupMulligan: ["cardInstanceIds"]
  });

  function gameActionPayload(action, fields = {}) {
    const allowed = GAME_ACTION_FIELDS[action];
    if (!allowed) throw new TypeError("This action is not supported by the trusted match reducer");
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new TypeError("Action fields must be an object");
    const extras = Object.keys(fields).filter(key => !allowed.includes(key));
    if (extras.length) throw new TypeError(`Unsupported fields for ${action}: ${extras.join(", ")}`);
    const payload = { type: "game-action", action };
    for (const key of allowed) {
      if (fields[key] !== undefined) payload[key] = fields[key];
    }
    return payload;
  }

  function assertSelection(selection) {
    if (selection === undefined) return {};
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new TypeError("Ability selection must be an object");
    const forbidden = new Set(["actorPlayerId", "actorAuthUid", "matchId", "actionId", "expectedStateVersion"]);
    const visit = (value, depth = 0) => {
      if (depth > 8) throw new RangeError("Ability selection is too deeply nested");
      if (Array.isArray(value)) { if (value.length > 100) throw new RangeError("Ability selection contains too many values"); value.forEach(item => visit(item, depth + 1)); return; }
      if (value && typeof value === "object") for (const [key, nested] of Object.entries(value)) {
        if (forbidden.has(key)) throw new TypeError("Actor, match, action, and version fields are assigned by the trusted command boundary");
        visit(nested, depth + 1);
      }
    };
    visit(selection);
    return selection;
  }

  function manualAbilityActivationPayload(sourceCardInstanceId, abilityId, selection) {
    if (typeof sourceCardInstanceId !== "string" || !sourceCardInstanceId || typeof abilityId !== "string" || !abilityId) throw new TypeError("Exact source card and ability IDs are required");
    return { type: "manual-ability-activation", sourceCardInstanceId, abilityId, selection: assertSelection(selection) };
  }

  function abilityResponsePayload({ instanceUid, abilityId, accept, selection = {} } = {}) {
    if (typeof instanceUid !== "string" || !instanceUid || typeof abilityId !== "string" || !abilityId || typeof accept !== "boolean") throw new TypeError("Exact pending source, ability, and accept/decline decision are required");
    return { type: "ability-response", accept, selection: { ...assertSelection(selection), instanceUid, abilityId } };
  }

  async function checkedRpc(client, name, args) {
    const response = await client.rpc(name, args);
    if (response?.error) throw new Error(response.error.message || `${name} failed`);
    return response?.data;
  }

  async function readPlayerState(client, roomCode) {
    const data = await checkedRpc(client, "get_match_state_for_player", { p_room_code: roomCode.toUpperCase() });
    if (!data?.ok || !data.state || !Number.isSafeInteger(Number(data.stateVersion))) {
      return { ok: false, reason: data?.reason || "match-state-unavailable" };
    }
    return { ok: true, stateVersion: Number(data.stateVersion), state: data.state };
  }

  function watchPlayerState(client, roomCode, options = {}) {
    if (!client || typeof client.rpc !== "function" || typeof roomCode !== "string" || !/^[A-Fa-f0-9]{16}$/.test(roomCode)) {
      throw new TypeError("An authenticated client and valid match room code are required");
    }
    if (typeof options.onState !== "function") throw new TypeError("onState callback is required");
    if (options.onError !== undefined && typeof options.onError !== "function") throw new TypeError("onError must be a function");
    const intervalMs = options.intervalMs === undefined ? 1000 : Number(options.intervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs < 100 || intervalMs > 60000) throw new RangeError("intervalMs must be between 100 and 60000 milliseconds");
    const schedule = options.setInterval || globalThis.setInterval;
    const cancel = options.clearInterval || globalThis.clearInterval;
    if (typeof schedule !== "function" || typeof cancel !== "function") throw new TypeError("interval scheduling functions are required");
    let stopped = false, lastVersion = -1, inFlight = null;

    function refresh() {
      if (stopped) return Promise.resolve(null);
      if (inFlight) return inFlight;
      const task = (async () => {
        try {
          const snapshot = await readPlayerState(client, roomCode);
          if (!snapshot.ok) throw new Error(snapshot.reason);
          if (!stopped && snapshot.stateVersion > lastVersion) {
            options.onState(snapshot);
            lastVersion = snapshot.stateVersion;
          }
          return snapshot;
        } catch (error) {
          if (!stopped) options.onError?.(error);
          return null;
        }
      })();
      inFlight = task;
      void task.then(() => { if (inFlight === task) inFlight = null; });
      return task;
    }

    const timer = schedule(() => { void refresh(); }, intervalMs);
    if (options.immediate !== false) void refresh();
    return Object.freeze({ refresh, stop() { if (stopped) return; stopped = true; cancel(timer); } });
  }

  async function submitAndProcess(client, input) {
    validateCommandInput(client, input);
    const roomCode = input.roomCode.toUpperCase();
    const command = await checkedRpc(client, "submit_match_action", {
      p_room_code: roomCode,
      p_action_id: input.actionId,
      p_expected_state_version: input.expectedStateVersion,
      p_payload: input.payload
    });
    if (!command?.ok) return { ok: false, queued: false, reason: command?.reason || "command-not-accepted", stateVersion: command?.stateVersion };

    let workerResult = null;
    if (command.queued || (command.duplicate && command.status === "queued")) {
      const invocation = await client.functions.invoke("match-worker", { body: { roomCode } });
      if (invocation?.error) {
        return { ok: false, queued: true, reason: invocation.error.message || "worker-invocation-failed", actionId: input.actionId };
      }
      workerResult = invocation?.data || null;
    }

    const [actionResult, projectedState] = await Promise.all([
      checkedRpc(client, "get_match_action_result", { p_room_code: roomCode, p_action_id: input.actionId }),
      readPlayerState(client, roomCode)
    ]);
    const status = actionResult?.status || (command.duplicate ? command.status : "queued");
    return {
      ok: status === "accepted",
      queued: status === "queued",
      status,
      ...(status === "rejected" ? { reason: actionResult?.result?.reason || "command-rejected" } : {}),
      actionId: input.actionId,
      workerResult,
      actionResult,
      projectedState
    };
  }

  return Object.freeze({ readPlayerState, watchPlayerState, submitAndProcess, validateCommandInput, gameActionPayload, manualAbilityActivationPayload, abilityResponsePayload });
});
