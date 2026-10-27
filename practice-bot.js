"use strict";

(function attachPracticeBot(root, factory) {
  const api = factory();
  if (root) root.VanguardPracticeBot = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createPracticeBotApi() {
  const circles = Object.freeze(["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"]);
  function rearGuardCircleForSlot(index) {
    if (!Number.isInteger(index) || index < 0) return null;
    return index < circles.length ? circles[index] : `accel-${index - circles.length + 1}`;
  }
  function advancePhase(match, nextPhase, phases, onPhaseChange) {
    if (!match || !Array.isArray(phases) || !phases.length) return false;
    const nextIndex = typeof nextPhase === "number" ? nextPhase : phases.indexOf(nextPhase);
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= phases.length) return false;
    const previous = phases[match.phase];
    if (match.phase === nextIndex) return true;
    match.phase = nextIndex;
    onPhaseChange?.(match.side, previous || null, phases[nextIndex]);
    return true;
  }
  return Object.freeze({ rearGuardCircleForSlot, advancePhase });
});
