"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const AuthorityClient = require("./match-authority-client.js");

function clientFor({ command = { ok: true, queued: true }, actionResult = { ok: true, status: "accepted", result: { ok: true } }, state = { ok: true, stateVersion: 8, state: { matchId: "m", players: {} } }, worker = { processed: true, accepted: true } } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      if (name === "submit_match_action") return { data: command };
      if (name === "get_match_action_result") return { data: actionResult };
      if (name === "get_match_state_for_player") return { data: state };
      throw new Error(`unexpected RPC ${name}`);
    },
    functions: { invoke: async (name, args) => { calls.push({ kind: "function", name, args }); return { data: worker }; } }
  };
}

const valid = { roomCode: "0123456789abcdef", actionId: "host-action-1", expectedStateVersion: 7, payload: { type: "game-action", action: "draw" } };

test("authority action adapter creates only allowlisted reducer commands", () => {
  assert.deepEqual(AuthorityClient.gameActionPayload("attack", {
    attackerCardInstanceId: "attacker-1", targetCardInstanceId: "target-2", boosterCardInstanceId: "booster-3"
  }), { type: "game-action", action: "attack", attackerCardInstanceId: "attacker-1", targetCardInstanceId: "target-2", boosterCardInstanceId: "booster-3" });
  assert.deepEqual(AuthorityClient.gameActionPayload("guard", { cardInstanceId: "guard-1", discardCardInstanceId: "cost-1" }),
    { type: "game-action", action: "guard", cardInstanceId: "guard-1", discardCardInstanceId: "cost-1" });
  assert.deepEqual(AuthorityClient.gameActionPayload("stride", { strideCardInstanceId: "g-unit-1", costCardInstanceIds: ["cost-1", "cost-2"] }),
    { type: "game-action", action: "stride", strideCardInstanceId: "g-unit-1", costCardInstanceIds: ["cost-1", "cost-2"] });
  assert.throws(() => AuthorityClient.gameActionPayload("manual-legacy-action", {}), /not supported/);
  assert.throws(() => AuthorityClient.gameActionPayload("attack", { attackerCardInstanceId: "a", actingPlayerId: "host" }), /Unsupported fields/);
});

test("authority action adapter preserves exact selections and rejects malformed fields containers", () => {
  const selected = ["card-a", "card-b"];
  assert.deepEqual(AuthorityClient.gameActionPayload("setupMulligan", { cardInstanceIds: selected }), {
    type: "game-action", action: "setupMulligan", cardInstanceIds: selected
  });
  assert.throws(() => AuthorityClient.gameActionPayload("draw", []), /must be an object/);
  assert.deepEqual(AuthorityClient.gameActionPayload("noGuard"), { type: "game-action", action: "noGuard" });
});

test("authority ability builders bind manual ACT and AUTO decisions to exact source and definition IDs", () => {
  assert.deepEqual(AuthorityClient.manualAbilityActivationPayload("source-instance", "reviewed-act", { costSelections: { cb: ["damage-1"] } }), {
    type: "manual-ability-activation", sourceCardInstanceId: "source-instance", abilityId: "reviewed-act", selection: { costSelections: { cb: ["damage-1"] } }
  });
  assert.deepEqual(AuthorityClient.abilityResponsePayload({ instanceUid: "auto-source", abilityId: "reviewed-auto", accept: true, selection: { targetUid: "target" } }), {
    type: "ability-response", accept: true, selection: { targetUid: "target", instanceUid: "auto-source", abilityId: "reviewed-auto" }
  });
  assert.deepEqual(AuthorityClient.abilityResponsePayload({ instanceUid: "auto-source", abilityId: "reviewed-auto", accept: false }), {
    type: "ability-response", accept: false, selection: { instanceUid: "auto-source", abilityId: "reviewed-auto" }
  });
  assert.throws(() => AuthorityClient.manualAbilityActivationPayload("", "ability", {}), /IDs are required/);
  assert.throws(() => AuthorityClient.abilityResponsePayload({ instanceUid: "source", abilityId: "ability", accept: "yes" }), /decision are required/);
  assert.throws(() => AuthorityClient.manualAbilityActivationPayload("source", "ability", { nested: { actorAuthUid: "forged" } }), /assigned by the trusted command boundary/);
});

test("authority client submits versioned action, invokes the worker, and returns the caller-projected state", async () => {
  const client = clientFor();
  const result = await AuthorityClient.submitAndProcess(client, valid);
  assert.deepEqual(client.calls.map(call => [call.kind, call.name]), [
    ["rpc", "submit_match_action"], ["function", "match-worker"],
    ["rpc", "get_match_action_result"], ["rpc", "get_match_state_for_player"]
  ]);
  assert.deepEqual(client.calls[0].args, {
    p_room_code: "0123456789ABCDEF", p_action_id: "host-action-1",
    p_expected_state_version: 7, p_payload: { type: "game-action", action: "draw" }
  });
  assert.deepEqual(client.calls[1].args, { body: { roomCode: "0123456789ABCDEF" } });
  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.projectedState.stateVersion, 8);
});

test("authority client does not invoke the worker when the server rejects a stale command", async () => {
  const client = clientFor({ command: { ok: false, queued: false, reason: "stale-state-version", stateVersion: 9 } });
  const result = await AuthorityClient.submitAndProcess(client, valid);
  assert.deepEqual(result, { ok: false, queued: false, reason: "stale-state-version", stateVersion: 9 });
  assert.equal(client.calls.some(call => call.kind === "function"), false);
  assert.equal(client.calls.length, 1);
});

test("authority client retries worker processing for an existing queued duplicate", async () => {
  const client = clientFor({ command: { ok: true, duplicate: true, status: "queued" }, actionResult: { ok: true, status: "queued" } });
  const result = await AuthorityClient.submitAndProcess(client, valid);
  assert.equal(client.calls.filter(call => call.kind === "function").length, 1);
  assert.equal(result.ok, false);
  assert.equal(result.queued, true);
  assert.equal(result.status, "queued");
});

test("authority client surfaces server rejection and keeps projected state available", async () => {
  const client = clientFor({
    actionResult: { ok: true, status: "rejected", result: { ok: false, reason: "wrong-timing-window" } },
    state: { ok: true, stateVersion: 7, state: { matchId: "m", players: {} } }
  });
  const result = await AuthorityClient.submitAndProcess(client, valid);
  assert.equal(result.ok, false);
  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "wrong-timing-window");
  assert.equal(result.projectedState.stateVersion, 7);
});

test("authority client rejects client-supplied actor and state identity fields before network calls", async () => {
  const client = clientFor();
  await assert.rejects(() => AuthorityClient.submitAndProcess(client, {
    ...valid, payload: { ...valid.payload, actorPlayerId: "opponent" }
  }), /assigned by the trusted command boundary/);
  assert.equal(client.calls.length, 0);
});

test("authority client leaves a recoverable queued result when worker invocation fails", async () => {
  const client = clientFor();
  client.functions.invoke = async () => ({ error: { message: "temporary worker failure" } });
  const result = await AuthorityClient.submitAndProcess(client, valid);
  assert.deepEqual(result, { ok: false, queued: true, reason: "temporary worker failure", actionId: "host-action-1" });
});

test("state watcher delivers only newer seat-projected versions and stops its timer", async () => {
  let responseVersion = 2, tick, cancelled = false;
  const states = [], errors = [];
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "get_match_state_for_player");
      assert.deepEqual(args, { p_room_code: "0123456789ABCDEF" });
      return { data: { ok: true, stateVersion: responseVersion, state: { version: responseVersion } } };
    }
  };
  const watcher = AuthorityClient.watchPlayerState(client, valid.roomCode, {
    immediate: false, intervalMs: 250, onState: snapshot => states.push(snapshot), onError: error => errors.push(error),
    setInterval: callback => { tick = callback; return "timer"; }, clearInterval: timer => { assert.equal(timer, "timer"); cancelled = true; }
  });
  await watcher.refresh();
  responseVersion = 1;
  await watcher.refresh();
  responseVersion = 2;
  await watcher.refresh();
  responseVersion = 3;
  tick();
  await watcher.refresh();
  assert.deepEqual(states.map(snapshot => snapshot.stateVersion), [2, 3]);
  assert.equal(errors.length, 0);
  watcher.stop();
  watcher.stop();
  assert.equal(cancelled, true);
  responseVersion = 4;
  assert.equal(await watcher.refresh(), null);
  assert.deepEqual(states.map(snapshot => snapshot.stateVersion), [2, 3]);
});

test("state watcher prevents overlapping polls and suppresses results after stop", async () => {
  let release, calls = 0, tick;
  const states = [];
  const client = { rpc: async () => { calls++; await new Promise(resolve => { release = resolve; }); return { data: { ok: true, stateVersion: 1, state: {} } }; } };
  const watcher = AuthorityClient.watchPlayerState(client, valid.roomCode, {
    immediate: false, onState: snapshot => states.push(snapshot), setInterval: callback => { tick = callback; return 1; }, clearInterval() {}
  });
  const first = watcher.refresh();
  const second = watcher.refresh();
  assert.equal(calls, 1);
  assert.equal(first, second);
  watcher.stop();
  release();
  await first;
  assert.equal(states.length, 0);
  tick();
  assert.equal(calls, 1);
});

test("state watcher reports failed or unavailable player projections without exposing another side", async () => {
  const errors = [];
  let call = 0;
  const client = { rpc: async () => {
    call++;
    return call === 1 ? { error: { message: "temporary read failure" } } : { data: { ok: false, reason: "match-not-initialized" } };
  } };
  const watcher = AuthorityClient.watchPlayerState(client, valid.roomCode, {
    immediate: false, onState: () => assert.fail("no unprojected or missing state should be delivered"), onError: error => errors.push(error),
    setInterval: () => 1, clearInterval() {}
  });
  await watcher.refresh();
  await watcher.refresh();
  assert.deepEqual(errors.map(error => error.message), ["temporary read failure", "match-not-initialized"]);
  watcher.stop();
});
