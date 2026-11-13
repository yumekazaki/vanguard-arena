/* User-controlled presentation speed. This module changes visuals only. */
(() => {
  "use strict";
  const KEY = "vanguard-animation-speed";
  const MODES = new Set(["normal", "fast", "reduced"]);

  function normalize(value) { return MODES.has(value) ? value : "normal"; }
  function getMode() {
    try { return normalize(window.localStorage?.getItem(KEY)); }
    catch { return "normal"; }
  }
  function apply() {
    const mode = getMode();
    if (document.documentElement) document.documentElement.dataset.animationSpeed = mode;
    const select = document.getElementById("animation-speed");
    if (select && select.value !== mode) select.value = mode;
    return mode;
  }
  function setMode(value) {
    const mode = normalize(value);
    try { window.localStorage?.setItem(KEY, mode); } catch { /* Keep the choice for this page session. */ }
    apply();
    return mode;
  }
  function duration(milliseconds) {
    const ms = Math.max(0, Number(milliseconds) || 0);
    return getMode() === "fast" ? Math.max(100, Math.round(ms * 0.55)) : ms;
  }

  window.VanguardAnimationSettings = Object.freeze({ getMode, setMode, duration });
  apply();
  document.getElementById("animation-speed")?.addEventListener("change", event => setMode(event.currentTarget.value));
})();
