/* Presentation only: reuse the rendered hand and its original action handlers. */
(() => {
  "use strict";
  const drawer = document.querySelector("#hand-drawer");
  const cards = document.querySelector("#hand-cards");
  const opener = document.querySelector("#open-hand");
  const closer = document.querySelector("#close-hand");
  const scrim = document.querySelector("#hand-scrim");
  if (!drawer || !cards || !opener || !closer || !scrim) return;
  // Animated views establish a fixed-position containing block. Keep this overlay at the page root.
  document.body.append(scrim, drawer);
  let closingTimer = null;
  let frame = null;

  function layoutFan() {
    frame = null;
    const items = [...cards.querySelectorAll(".game-card-wrap")];
    const count = items.length;
    document.querySelector("#hand-button-count").textContent = String(count);
    opener.setAttribute("aria-label", `Hand, ${count} card${count === 1 ? "" : "s"}`);
    if (drawer.hidden) return;
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
      item.style.setProperty("--fan-y", `${unit * unit * 28}px`);
      item.style.setProperty("--fan-angle", `${unit * Math.min(23, (count - 1) * 3.5)}deg`);
      item.style.setProperty("--fan-order", String(index + 1));
      item.style.setProperty("--fan-delay", `${Math.min(index * 28, 280)}ms`);
    });
  }
  function scheduleLayout() {
    if (frame === null) frame = requestAnimationFrame(layoutFan);
  }
  function closeHand(restoreFocus = true) {
    if (drawer.hidden) return;
    drawer.classList.remove("is-open");
    opener.setAttribute("aria-expanded", "false");
    scrim.hidden = true;
    drawer.inert = true;
    document.body.classList.remove("hand-menu-open");
    if (restoreFocus) opener.focus({ preventScroll: true });
    clearTimeout(closingTimer);
    closingTimer = setTimeout(() => { drawer.hidden = true; }, 180);
  }
  function openHand() {
    clearTimeout(closingTimer);
    drawer.hidden = false;
    drawer.inert = false;
    scrim.hidden = false;
    document.body.classList.add("hand-menu-open");
    opener.setAttribute("aria-expanded", "true");
    layoutFan();
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    closer.focus({ preventScroll: true });
  }
  opener.addEventListener("click", openHand);
  closer.addEventListener("click", () => closeHand());
  scrim.addEventListener("click", () => closeHand());
  // Let the existing hand handler choose the card and open its normal action menu.
  cards.addEventListener("click", event => {
    if (event.target.closest("[data-hand-uid]") && !event.target.closest("[data-card-zoom]")) closeHand(false);
  });
  drawer.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeHand(); }
    if (event.key !== "Tab") return;
    const focusable = [...drawer.querySelectorAll("button:not(:disabled), [tabindex='0']")].filter(node => node.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  cards.addEventListener("focusin", event => event.target.closest(".game-card-wrap")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  new MutationObserver(scheduleLayout).observe(cards, { childList: true });
  new ResizeObserver(scheduleLayout).observe(cards.parentElement);
  new MutationObserver(() => {
    if (!document.querySelector("#view-play.active-view") && !drawer.hidden) closeHand(false);
  }).observe(document.querySelector("#view-play"), { attributes: true, attributeFilter: ["class"] });
  layoutFan();
})();
