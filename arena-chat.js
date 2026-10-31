/* Ephemeral player chat, isolated from game actions and match snapshots. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardTableChat = api;
})(typeof globalThis === "undefined" ? this : globalThis, function() {
  "use strict";
  const MAX_TEXT = 500, MAX_MESSAGES = 100;
  function createChat({ onChange = () => {}, now = Date.now, makeId = () => crypto.randomUUID() } = {}) {
    let session = {}, key = "", messages = [], seen = new Set(), sending = false, notice = "";
    const visible = () => ["host", "guest"].includes(session.role) && Boolean(session.sessionId && session.matchId);
    function state() { return { visible: visible(), connected: visible() && session.connected, sending, notice, messages, localName: session.localName || "You", opponentName: session.opponentName || "Opponent" }; }
    function emit() { onChange(state()); }
    function append(message) {
      if (seen.has(message.id)) return;
      seen.add(message.id);
      if (seen.size > 200) seen.delete(seen.values().next().value);
      messages = [...messages, message].slice(-MAX_MESSAGES);
      emit();
    }
    function setSession(next) {
      const nextKey = ["host", "guest"].includes(next.role) && next.sessionId && next.matchId ? next.role + ":" + next.sessionId + ":" + next.matchId : "";
      if (nextKey !== key) { messages = []; seen = new Set(); sending = false; notice = ""; }
      key = nextKey; session = next;
      emit();
    }
    function receive(message) {
      if (!visible() || message?.type !== "table-chat" || message.matchId !== session.matchId || typeof message.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(message.id) || typeof message.text !== "string") return false;
      const text = message.text.trim();
      if (!text || text.length > MAX_TEXT || seen.has(message.id)) return false;
      append({ id: message.id, text, own: false, time: now() });
      return true;
    }
    async function send(value) {
      const text = String(value || "").trim();
      if (!text || sending) return false;
      if (!visible() || !session.connected || typeof session.send !== "function") { notice = "Wait for your opponent to connect."; emit(); return false; }
      if (text.length > MAX_TEXT) { notice = "Keep messages under 500 characters."; emit(); return false; }
      const currentKey = key, message = { type: "table-chat", id: makeId(), matchId: session.matchId, text };
      sending = true; notice = ""; emit();
      try {
        const result = await session.send(message);
        if (key !== currentKey) return false;
        if (result === false) throw new Error("not-sent");
        append({ id: message.id, text, own: true, time: now() });
        return true;
      } catch {
        if (key === currentKey) notice = "Message not sent. Check the connection and try again.";
        return false;
      } finally {
        if (key === currentKey) { sending = false; emit(); }
      }
    }
    return { setSession, receive, send, getState: state };
  }
  function mount(doc) {
    const panel = doc.querySelector("#online-chat"), history = doc.querySelector("#online-chat-history");
    if (!panel || !history) return null;
    const form = doc.querySelector("#online-chat-form"), input = doc.querySelector("#online-chat-input"), button = doc.querySelector("#online-chat-send"), status = doc.querySelector("#online-chat-status");
    let displayed = null;
    const chat = createChat({ onChange(state) {
      panel.hidden = !state.visible;
      input.disabled = !state.connected;
      button.disabled = !state.connected || state.sending;
      status.textContent = state.notice || (state.connected ? "Only you and your opponent · this match" : "Waiting for your opponent to connect…");
      panel.classList.toggle("chat-connected", Boolean(state.connected));
      if (displayed === state.messages) return;
      const wasNearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 50;
      displayed = state.messages;
      const nodes = state.messages.map(message => {
        const item = doc.createElement("li"); item.className = "table-chat-message" + (message.own ? " own-message" : "");
        const meta = doc.createElement("div"); meta.className = "table-chat-meta";
        const name = doc.createElement("b"); name.textContent = message.own ? "You" : state.opponentName;
        const time = doc.createElement("time"); time.dateTime = new Date(message.time).toISOString(); time.textContent = new Date(message.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
        const body = doc.createElement("p"); body.textContent = message.text;
        meta.append(name, time); item.append(meta, body); return item;
      });
      if (!nodes.length) { const empty = doc.createElement("li"); empty.className = "table-chat-empty"; empty.textContent = "Say hello. Plan your next cardfight."; nodes.push(empty); }
      history.replaceChildren(...nodes);
      if (wasNearBottom || state.messages.at(-1)?.own) history.scrollTop = history.scrollHeight;
    } });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const value = input.value;
      if (await chat.send(value)) { if (input.value === value) input.value = ""; input.focus(); }
    });
    chat.setSession({});
    return chat;
  }
  const api = { MAX_TEXT, MAX_MESSAGES, createChat, mount };
  if (typeof document !== "undefined") api.controller = mount(document);
  return api;
});
