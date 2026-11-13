/* Optional, client-only first-match tour. It never changes match state. */
(() => {
  "use strict";

  const steps = Object.freeze([
    Object.freeze({ title: "Keep your hand ready", copy: "Your hand stays in a tray during play. Use the Hand button to collapse or reopen it. On desktop, drag a card to a legal circle; on a phone, tap the card, then tap its highlighted destination." }),
    Object.freeze({ title: "Follow the phase rail", copy: "The phase rail shows where the turn is. Read the short hint under it for the next step. Manual progression is always available; Assisted only moves through safe empty phases." }),
    Object.freeze({ title: "Use direct battle actions", copy: "Choose a legal attacker and target by tapping the highlighted unit, or drag on desktop. Boost, guard, drive checks, and trigger prompts still ask the players who must decide them." }),
    Object.freeze({ title: "Inspect zones and prompts", copy: "Open Damage, Soul, Drop, Bind, and G Zone from their battlefield controls. Face-down cards stay hidden where the rules require. Ability prompts identify optional actions and mandatory resolutions." })
  ]);

  function normalizeIndex(value) {
    const index = Number(value);
    return Number.isInteger(index) ? Math.max(0, Math.min(steps.length - 1, index)) : 0;
  }
  function stepAt(value) { return steps[normalizeIndex(value)]; }

  const api = Object.freeze({ count: steps.length, normalizeIndex, stepAt });
  window.VanguardQuickGuide = api;

  const dialog = document.getElementById("quick-guide-dialog");
  const openButton = document.getElementById("open-quick-guide");
  const title = document.getElementById("quick-guide-title");
  const copy = document.getElementById("quick-guide-copy");
  const count = document.getElementById("quick-guide-count");
  const progress = document.getElementById("quick-guide-progress");
  const back = document.getElementById("quick-guide-back");
  const next = document.getElementById("quick-guide-next");
  const finish = document.getElementById("quick-guide-done");
  let current = 0;

  if (!dialog || !openButton || !title || !copy || !count || !progress || !back || !next || !finish) return;

  function render() {
    const item = steps[current];
    title.textContent = item.title;
    copy.textContent = item.copy;
    count.textContent = `${current + 1} / ${steps.length}`;
    back.disabled = current === 0;
    next.hidden = current === steps.length - 1;
    finish.hidden = current !== steps.length - 1;
    progress.innerHTML = steps.map((step, index) => `<button class="quick-guide-dot${index === current ? " active" : ""}" type="button" data-guide-step="${index}" aria-label="Step ${index + 1}: ${step.title}" aria-current="${index === current ? "step" : "false"}"></button>`).join("");
  }

  openButton.addEventListener("click", () => {
    document.getElementById("help-dialog")?.close();
    current = 0;
    render();
    if (!dialog.open) dialog.showModal();
  });
  back.addEventListener("click", () => { current = normalizeIndex(current - 1); render(); });
  next.addEventListener("click", () => { current = normalizeIndex(current + 1); render(); });
  finish.addEventListener("click", () => dialog.close());
  document.getElementById("quick-guide-close-x")?.addEventListener("click", () => dialog.close());
  progress.addEventListener("click", event => {
    const button = event.target.closest("[data-guide-step]");
    if (!button) return;
    current = normalizeIndex(button.dataset.guideStep);
    render();
  });
  dialog.addEventListener("close", () => document.getElementById("help-button")?.focus());
})();
