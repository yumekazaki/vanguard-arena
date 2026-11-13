(() => {
  "use strict";
  function topDeck(cards, count) {
    const deck = Array.isArray(cards) ? cards : [];
    const requested = Number(count);
    if (!Number.isFinite(requested) || requested <= 0) return [];
    const limit = Math.min(deck.length, Math.floor(requested));
    return limit ? deck.slice(-limit) : [];
  }
  const api = Object.freeze({ topDeck });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.VanguardAbilityChoiceView = api;
})();
