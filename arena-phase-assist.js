/* Optional conservative turn helper. It never auto-passes player-choice phases. */
(() => {
  "use strict";
  const KEY = "vanguard-phase-progression";

  function normalize(value) { return value === "assisted" ? "assisted" : "manual"; }
  function getMode() {
    try { return normalize(window.localStorage?.getItem(KEY)); }
    catch { return "manual"; }
  }
  function setMode(value) {
    const mode = normalize(value);
    try { window.localStorage?.setItem(KEY, mode); } catch { /* The page can still use the selected mode. */ }
    apply();
    return mode;
  }
  function apply() {
    const mode = getMode();
    if (document.documentElement) document.documentElement.dataset.phaseProgression = mode;
    const select = document.getElementById("phase-progression");
    if (select && select.value !== mode) select.value = mode;
    return mode;
  }
  function shouldAdvance(context = {}) {
    if (getMode() !== "assisted" || context.side !== "human" || context.isLocalTurn !== true || context.ended === true) return false;
    if (context.pendingDecision === true || context.hasLegalDecision === true) return false;
    if (context.phase === 0) return true;
    if (context.phase === 1) return context.drewThisTurn === true && context.canGAssist !== true;
    return false;
  }

  window.VanguardPhaseAssist = Object.freeze({ getMode, setMode, shouldAdvance });
  apply();
  document.getElementById("phase-progression")?.addEventListener("change", event => setMode(event.currentTarget.value));
})();
