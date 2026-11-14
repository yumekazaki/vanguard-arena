/* Persistent hand rail. The hand never collapses or covers the battlefield. */
(() => {
  "use strict";
  const drawer = document.querySelector("#hand-drawer");
  const cards = document.querySelector("#hand-cards");
  const playView = document.querySelector("#view-play");
  const matchLayout = document.querySelector("#match-layout");
  const matchEmpty = document.querySelector("#match-empty");
  if (!drawer || !cards || !playView || !matchLayout) return;

  let guarding = false;
  let frame = null;
  let defense = { active: false, canFinish: false };
  const done = document.querySelector("#hand-done-guarding");
  const hint = drawer.querySelector(".hand-fan-hint");
  const normalHint = hint?.textContent || "Select a card for its actions.";

  function isMatchVisible() {
    return Boolean(playView.classList.contains("active-view") && !matchLayout.classList.contains("hidden") &&
      (!matchEmpty || matchEmpty.classList.contains("hidden")));
  }
  function layoutCards() {
    frame = null;
    const items = [...cards.querySelectorAll(".game-card-wrap")];
    const width = cards.parentElement?.clientWidth || drawer.clientWidth || 760;
    const count = items.length;
    const visibleCount = Math.max(1, count || 1);
    const gap = width < 650 ? 7 : 10;
    const cardWidth = Math.max(width < 650 ? 74 : 58, Math.min(width < 650 ? 112 : 128,
      (width - gap * (visibleCount - 1)) / visibleCount));
    cards.style.setProperty("--hand-card-width", `${Math.round(cardWidth)}px`);
    cards.style.removeProperty("width");
    items.forEach((item, index) => {
      item.style.removeProperty("left");
      item.style.removeProperty("top");
      item.style.removeProperty("transform");
      item.style.removeProperty("z-index");
      item.style.removeProperty("--fan-x");
      item.style.removeProperty("--fan-y");
      item.style.removeProperty("--fan-angle");
      item.style.setProperty("--fan-delay", `${Math.min(index * 18, 180)}ms`);
    });
  }
  function scheduleLayout() {
    if (frame === null) frame = requestAnimationFrame(layoutCards);
  }
  function syncPresentation() {
    const active = isMatchVisible();
    drawer.hidden = !active;
    drawer.inert = false;
    drawer.classList.toggle("is-persistent", active);
    drawer.classList.toggle("is-expanded", active);
    drawer.classList.remove("is-collapsed", "is-modal", "is-open");
    drawer.setAttribute("role", "region");
    drawer.removeAttribute("aria-modal");
    if (done) {
      done.hidden = !guarding;
      done.disabled = !defense.canFinish;
    }
    if (hint) hint.textContent = guarding
      ? "Select cards to guard with, then choose Done guarding to finish your defense."
      : normalHint;
    scheduleLayout();
  }
  function closeGuardMode() {
    guarding = false;
    syncPresentation();
  }

  // Let the existing hand handler choose cards and open its usual action menu.
  cards.addEventListener("dragstart", event => {
    const card = event.target.closest("[data-hand-uid]");
    if (!card || guarding || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.handUid);
    card.classList.add("is-dragging");
  });
  cards.addEventListener("dragend", event => event.target.closest("[data-hand-uid]")?.classList.remove("is-dragging"));
  matchLayout.addEventListener("dragover", event => {
    const zone = event.target.closest(".field-zone[data-side='human'][data-zone]");
    if (!zone || !event.dataTransfer?.types?.includes("text/plain")) return;
    event.preventDefault();
    zone.classList.add("drop-target-hover");
  });
  matchLayout.addEventListener("dragleave", event => {
    const zone = event.target.closest(".field-zone.drop-target-hover");
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("drop-target-hover");
  });
  matchLayout.addEventListener("drop", event => {
    const zone = event.target.closest(".field-zone[data-side='human'][data-zone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("drop-target-hover");
    const uid = event.dataTransfer?.getData("text/plain");
    if (uid) document.dispatchEvent(new CustomEvent("arena:place-from-hand", { detail: { uid, zone: zone.dataset.zone } }));
  });
  cards.addEventListener("click", event => {
    const card = event.target.closest("[data-hand-uid]");
    if (!guarding || !card || event.target.closest("[data-card-zoom]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (defense.canFinish) document.dispatchEvent(new CustomEvent("arena:guard-card", { detail: { uid: card.dataset.handUid } }));
  }, true);
  cards.addEventListener("focusin", event => event.target.closest(".game-card-wrap")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  new MutationObserver(syncPresentation).observe(playView, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(syncPresentation).observe(matchLayout, { attributes: true, attributeFilter: ["class"] });
  if (matchEmpty) new MutationObserver(syncPresentation).observe(matchEmpty, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(scheduleLayout).observe(cards, { childList: true });
  new ResizeObserver(scheduleLayout).observe(cards.parentElement);
  done?.addEventListener("click", () => {
    if (!guarding || !defense.canFinish) return;
    document.dispatchEvent(new CustomEvent("arena:done-guarding"));
    closeGuardMode();
  });

  window.VanguardHand = {
    open({ guarding: guardMode = false } = {}) {
      guarding = Boolean(guardMode && defense.active);
      syncPresentation();
      if (guarding) drawer.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    close() { closeGuardMode(); },
    syncDefense(next) {
      defense = next || { active: false, canFinish: false };
      if (!defense.active) guarding = false;
      if (done) done.disabled = !defense.canFinish;
      syncPresentation();
    }
  };
  syncPresentation();
  layoutCards();
})();
