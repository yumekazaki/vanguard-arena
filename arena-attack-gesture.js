/* Maps an attack gesture to an already-rendered legal target choice. */
(() => {
  "use strict";
  function targetAction(setup, gesture, choices) {
    if (!setup || setup.stage !== "target" || !gesture || setup.attackerUid !== gesture.attackerUid) return null;
    const value = `target:${gesture.zone}:${gesture.targetUid}`;
    return (choices || []).some(choice => choice?.value === value) ? `attack-choice:${value}` : null;
  }
  window.VanguardAttackGesture = Object.freeze({ targetAction });
})();
