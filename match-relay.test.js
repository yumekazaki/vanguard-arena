"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createConnection } = require("./match-relay.js");

class FakeChannel {
  constructor(topic) { this.topic = topic; this.listeners = new Map(); this.sent = []; this.statusCallback = null; }
  on(type, options, callback) { this.listeners.set(`${type}:${options.event}`, callback); return this; }
  subscribe(callback) { this.statusCallback = callback; callback("SUBSCRIBED"); return this; }
  async send(envelope) { this.sent.push(envelope); return "ok"; }
  deliver(event, envelope) { this.listeners.get(`broadcast:${event}`)?.({ payload: envelope }); }
}
function fakeClient(autoSubscribe = true) {
  const channels = new Map(), removed = [];
  return { channels, removed, channel(topic, options) { const channel = new FakeChannel(topic); channel.options = options; if (!autoSubscribe) channel.subscribe = callback => { channel.statusCallback = callback; return channel; }; channels.set(topic, channel); return channel; }, removeChannel(channel) { removed.push(channel); } };
}

test("guest sends only on guest-host and receives host messages on host-guest", async () => {
  const client = fakeClient(), received = [];
  const connection = createConnection({ client, outgoingTopic: "room:guest-host", incomingTopic: "room:host-guest", outgoingEvent: "to-host", incomingEvent: "to-player", senderRole: "player" });
  connection.on("data", envelope => received.push(envelope));
  assert.equal(connection.open, true);
  assert.equal(await connection.send({ type: "action", action: "draw" }), true);
  assert.deepEqual(client.channels.get("room:guest-host").sent[0], { type: "broadcast", event: "to-host", payload: { senderRole: "player", message: { type: "action", action: "draw" } } });
  client.channels.get("room:host-guest").deliver("to-player", { senderRole: "host", message: { type: "snapshot" } });
  assert.deepEqual(received, [{ senderRole: "host", message: { type: "snapshot" } }]);
  assert.equal(client.channels.get("room:guest-host").listeners.has("broadcast:to-player"), false);
  connection.close();
  assert.equal(client.removed.length, 2);
});

test("host sends only on host-guest and receives guest messages on guest-host", async () => {
  const client = fakeClient(), received = [];
  const connection = createConnection({ client, outgoingTopic: "room:host-guest", incomingTopic: "room:guest-host", outgoingEvent: "to-player", incomingEvent: "to-host", senderRole: "host" });
  connection.on("data", envelope => received.push(envelope));
  assert.equal(await connection.send({ type: "snapshot" }), true);
  assert.equal(client.channels.get("room:host-guest").sent[0].event, "to-player");
  client.channels.get("room:guest-host").deliver("to-host", { senderRole: "player", message: { type: "action" } });
  assert.equal(received[0].message.type, "action");
});

test("connection waits for both channel subscriptions and closes safely before readiness", () => {
  const client = fakeClient(false);
  for (const channel of client.channels.values()) channel.subscribe = callback => { channel.statusCallback = callback; return channel; };
  const connection = createConnection({ client, outgoingTopic: "a", incomingTopic: "b", outgoingEvent: "send", incomingEvent: "receive", senderRole: "host" });
  client.channels.get("a").statusCallback("SUBSCRIBED");
  assert.equal(connection.open, false);
  client.channels.get("b").statusCallback("SUBSCRIBED");
  assert.equal(connection.open, true);
  connection.close();
  assert.equal(client.removed.length, 2);
  const pendingClient = fakeClient(false);
  const pending = createConnection({ client: pendingClient, outgoingTopic: "c", incomingTopic: "d", outgoingEvent: "send", incomingEvent: "receive", senderRole: "host" });
  pending.close();
  pendingClient.channels.get("c").statusCallback("SUBSCRIBED");
  assert.equal(pending.open, false);
});

test("single-topic spectator connections subscribe and open once", () => {
  const client = fakeClient(), connection = createConnection({ client, outgoingTopic: "watch", incomingTopic: "watch", outgoingEvent: "to-watchers", incomingEvent: "to-watchers", senderRole: "watcher", isPrivate: false });
  assert.equal(client.channels.size, 1);
  assert.equal(connection.open, true);
  assert.equal(client.channels.get("watch").options.config.private, false);
});