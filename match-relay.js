(function attachMatchRelay(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchRelay = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchRelayModule() {
  function createConnection({ client, outgoingTopic, incomingTopic = outgoingTopic, outgoingEvent, incomingEvent, senderRole, isPrivate = true }) {
    if (!client || typeof client.channel !== "function") throw new TypeError("A Realtime client is required.");
    if (!outgoingTopic || !incomingTopic || !outgoingEvent || !incomingEvent || !senderRole) throw new TypeError("Relay topics, events, and sender role are required.");
    const handlers = { open: [], data: [], close: [], error: [] };
    const outgoing = client.channel(outgoingTopic, { config: { broadcast: { self: false }, private: isPrivate } });
    const incoming = incomingTopic === outgoingTopic ? outgoing : client.channel(incomingTopic, { config: { broadcast: { self: false }, private: isPrivate } });
    let outgoingReady = false, incomingReady = false, closed = false;
    const connection = {
      open: false,
      isRelay: true,
      on(event, callback) { (handlers[event] ||= []).push(callback); return this; },
      off(event, callback) { handlers[event] = (handlers[event] || []).filter(item => item !== callback); return this; },
      emit(event, value) { (handlers[event] || []).slice().forEach(callback => callback(value)); },
      async send(message) {
        if (!this.open || closed) return false;
        try {
          const status = await outgoing.send({ type: "broadcast", event: outgoingEvent, payload: { senderRole, message } });
          if (status !== "ok") this.emit("error", { type: "relay-error", message: "The online relay could not send an update." });
          return status === "ok";
        } catch (error) {
          this.emit("error", { type: "relay-error", message: error?.message || "The online relay could not send an update." });
          return false;
        }
      },
      close() {
        if (closed) return;
        closed = true; this.open = false;
        void client.removeChannel(outgoing);
        if (incoming !== outgoing) void client.removeChannel(incoming);
        this.emit("close");
      }
    };
    incoming.on("broadcast", { event: incomingEvent }, envelope => connection.emit("data", envelope?.payload || {}));
    const onStatus = direction => status => {
      if (status === "SUBSCRIBED") {
        if (closed) return;
        if (direction === "out") outgoingReady = true; else incomingReady = true;
        if (outgoingReady && incomingReady && !connection.open) { connection.open = true; connection.emit("open"); }
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        connection.emit("error", { type: "relay-error", message: `The online relay ${status.toLowerCase().replace(/_/g, " ")}.` });
      }
    };
    if (incoming === outgoing) outgoing.subscribe(status => { onStatus("out")(status); onStatus("in")(status); });
    else { outgoing.subscribe(onStatus("out")); incoming.subscribe(onStatus("in")); }
    return connection;
  }
  return Object.freeze({ createConnection });
});