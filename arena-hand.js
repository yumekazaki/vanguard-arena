(() => {
  "use strict";
  const drawer = document.querySelector("#hand-drawer");
  const cards = document.querySelector("#hand-cards");
  const opener = document.querySelector("#open-hand");
  const closer = document.querySelector("#close-hand");
  const scrim = document.querySelector("#hand-scrim");
  const playView = document.querySelector("#view-play");
  const matchLayout = document.querySelector("#match-layout");
  const matchEmpty = document.querySelector("#match-empty");
  if (!drawer || !cards || !opener || !closer || !scrim) return;

  // Animated views establish a fixed-position containing block. Keep the hand dock at the page root.
  document.body.append(scrim, drawer);
  let closingTimer = null;
  let frame = null;
  let guarding = false;
  let modal = false;
  let persistent = false;
  let expanded = false;
  let expandedBeforeGuard = true;
  let defense = { active: false, canFinish: false };
  const done = document.querySelector("#hand-done-guarding");
  const hint = drawer.querySelector(".hand-fan-hint");
  const handTools = drawer.querySelector(".hand-drawer-tools");
  const launcher = opener.closest(".hand-launcher");
  const normalHint = hint.textContent;
  const preferenceKey = "vanguard-hand-tray-expanded";

  // Keep one hand control: it lives in the tray header and toggles the tray open/collapsed.
  if (handTools && opener.parentElement !== handTools) handTools.prepend(opener);
  launcher?.remove();

  function readExpandedPreference() {
    try {
      const saved = localStorage.getItem(preferenceKey);
      return saved === null ? true : saved === "true";
    } catch { return true; }
  }
  function saveExpandedPreference(value) {
    try { localStorage.setItem(preferenceKey, String(Boolean(value))); } catch {}
  }
  function isMatchVisible() {
    return Boolean(playView?.classList.contains("active-view") && matchLayout && !matchLayout.classList.contains("hidden") && (!matchEmpty || matchEmpty.classList.contains("hidden")));
  }
  function layoutFan() {
    frame = null;
    const items = [...cards.querySelectorAll(".game-card-wrap")];
    const count = items.length;
    document.querySelector("#hand-button-count").textContent = String(count);
    opener.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} hand, ${count} card${count === 1 ? "" : "s"}`);
    if (drawer.hidden || !expanded) return;
    const width = cards.parentElement.clientWidth;
    const cardWidth = width < 600 ? 138 : 182;
    const available = Math.max(cardWidth, width - 64);
    const step = count > 1 ? Math.max(38, Math.min(cardWidth * .68, (available - cardWidth) / (count - 1))) : 0;
    const fanWidth = Math.max(width, cardWidth + step * Math.max(0, count - 1) + 64);
    cards.style.width = `${fanWidth}px`;
    cards.style.setProperty("--hand-card-width", `${cardWidth}px`);
    items.forEach((item, index) => {
      const center = index - (count - 1) / 2;
      const unit = count > 1 ? center / ((count - 1) / 2) : 0;
      item.style.setProperty("--fan-x", `${center * step}px`);
      item.style.setProperty("--fan-y", `${unit * unit * 16}px`);
      item.style.setProperty("--fan-angle", `${unit * Math.min(17, (count - 1) * 2.5)}deg`);
      item.style.setProperty("--fan-order", String(index + 1));
      item.style.setProperty("--fan-delay", `${Math.min(index * 20, 240)}ms`);
    });
  }
  function scheduleLayout() {
    if (frame === null) frame = requestAnimationFrame(layoutFan);
  }
  function syncPresentation() {
    drawer.hidden = !persistent && !modal;
    drawer.inert = false;
    drawer.classList.toggle("is-persistent", persistent);
    drawer.classList.toggle("is-expanded", expanded);
    drawer.classList.toggle("is-collapsed", persistent && !expanded && !modal);
    drawer.classList.toggle("is-open", persistent || modal);
    drawer.classList.toggle("is-modal", modal);
    drawer.setAttribute("role", modal ? "dialog" : "region");
    if (modal) drawer.setAttribute("aria-modal", "true");
    else drawer.removeAttribute("aria-modal");
    opener.setAttribute("aria-expanded", String(expanded || modal));
    scrim.hidden = !modal;
    document.body.classList.toggle("hand-menu-open", modal);
    closer.setAttribute("aria-label", modal ? "Close hand" : persistent && expanded ? "Collapse hand" : "Expand hand");
    closer.hidden = persistent && !modal;
    closer.innerHTML = 'Close <span aria-hidden="true">×</span>';
    opener.hidden = modal;
    opener.title = expanded ? "Collapse hand" : "Expand hand";
    const arrow = opener.querySelector(".hand-button-arrow");
    if (arrow) arrow.textContent = expanded ? "⌄" : "⌃";
    if (done) { done.hidden = !guarding; done.disabled = !defense.canFinish; }
    hint.textContent = guarding ? "Select cards to guard with, then choose Done guarding. Closing this hand does not finish your defense." : normalHint;
    scheduleLayout();
  }
  function syncMatchVisibility() {
    const active = isMatchVisible();
    if (active && !persistent) {
      persistent = true;
      expanded = readExpandedPreference();
      syncPresentation();
    } else if (!active && persistent) {
      persistent = false;
      modal = false;
      guarding = false;
      syncPresentation();
    }
  }
  function collapseHand(restoreFocus = true) {
    if (modal && guarding) {
      modal = false;
      guarding = false;
      expanded = persistent ? expandedBeforeGuard : false;
      if (!persistent) drawer.hidden = true;
    } else if (persistent && isMatchVisible()) {
      expanded = false;
      saveExpandedPreference(false);
    } else {
      persistent = false;
      expanded = false;
    }
    syncPresentation();
    if (restoreFocus) opener.focus({ preventScroll: true });
  }
  function closeHand(restoreFocus = true) {
    if (persistent && !modal && !restoreFocus) return;
    collapseHand(restoreFocus);
  }
  function openHand({ guarding: guardMode = false } = {}) {
    const guardRequest = Boolean(guardMode && defense.active);
    if (guardRequest && !modal) expandedBeforeGuard = expanded;
    guarding = guardRequest;
    modal = guardRequest;
    if (!persistent) persistent = isMatchVisible();
    expanded = true;
    if (!guarding) saveExpandedPreference(true);
    syncPresentation();
    closer.focus({ preventScroll: true });
  }
  opener.addEventListener("click", () => {
    if (modal) return;
    if (persistent && expanded) collapseHand();
    else openHand();
  });
  closer.addEventListener("click", () => collapseHand());
  scrim.addEventListener("click", () => collapseHand());
  // Let the existing hand handler choose cards and open its normal action menu.
  cards.addEventListener("dragstart", event => {
    const card = event.target.closest("[data-hand-uid]");
    if (!card || guarding || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.handUid);
    card.classList.add("is-dragging");
  });
  cards.addEventListener("dragend", event => event.target.closest("[data-hand-uid]")?.classList.remove("is-dragging"));
  const matchArea = document.querySelector("#match-layout");
  matchArea?.addEventListener("dragover", event => {
    const zone = event.target.closest(".field-zone[data-side='human'][data-zone]");
    if (!zone || !event.dataTransfer?.types?.includes("text/plain")) return;
    event.preventDefault();
    zone.classList.add("drop-target-hover");
  });
  matchArea?.addEventListener("dragleave", event => {
    const zone = event.target.closest(".field-zone.drop-target-hover");
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("drop-target-hover");
  });
  matchArea?.addEventListener("drop", event => {
    const zone = event.target.closest(".field-zone[data-side='human'][data-zone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("drop-target-hover");
    const uid = event.dataTransfer?.getData("text/plain");
    if (uid) document.dispatchEvent(new CustomEvent("arena:place-from-hand", { detail: { uid, zone: zone.dataset.zone } }));
  });
  cards.addEventListener("click", event => {
    const card = event.target.closest("[data-hand-uid]");
    if (guarding && card && !event.target.closest("[data-card-zoom]")) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (defense.canFinish) document.dispatchEvent(new CustomEvent("arena:guard-card", { detail: { uid: card.dataset.handUid } }));
    }
  }, true);
  drawer.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); collapseHand(); return; }
    if (event.key !== "Tab" || !modal) return;
    const focusable = [...drawer.querySelectorAll("button:not(:disabled), [tabindex='0']")].filter(node => node.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  cards.addEventListener("focusin", event => event.target.closest(".game-card-wrap")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  new MutationObserver(scheduleLayout).observe(cards, { childList: true });
  new ResizeObserver(scheduleLayout).observe(cards.parentElement);
  if (playView) new MutationObserver(syncMatchVisibility).observe(playView, { attributes: true, attributeFilter: ["class"] });
  if (matchLayout) new MutationObserver(syncMatchVisibility).observe(matchLayout, { attributes: true, attributeFilter: ["class"] });
  if (matchEmpty) new MutationObserver(syncMatchVisibility).observe(matchEmpty, { attributes: true, attributeFilter: ["class"] });
  done?.addEventListener("click", () => {
    if (!guarding || !defense.canFinish) return;
    document.dispatchEvent(new CustomEvent("arena:done-guarding"));
    collapseHand();
  });
  window.VanguardHand = {
    open: openHand,
    close: closeHand,
    syncDefense(next) {
      defense = next;
      if (done) done.disabled = !defense.canFinish;
      if (guarding && !defense.active) collapseHand(false);
    }
  };
  syncMatchVisibility();
  layoutFan();
})();
