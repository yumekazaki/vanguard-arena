/* Client-only animation layer. It observes rendered match state but never changes game state or actions. */
(() => {
  "use strict";
  const beforeCards = new Map();
  let previous = null;
  const activeTimers = new WeakMap();

  function fields() { return [...document.querySelectorAll("#match-layout .field-card[data-field-uid]")]; }
  function readLocations(match) {
    const locations = new Map();
    const add = (card, side, zone, index = -1) => { if (card?.uid) locations.set(card.uid, { side, zone, index }); };
    for (const side of ["human", "bot"]) {
      const player = match?.players?.[side]; if (!player) continue;
      add(player.vanguard, side, "vanguard");
      (player.rear || []).forEach((card, index) => add(card, side, index >= 5 ? `accel-${index - 4}` : `rear-${index}` , index));
      for (const zone of ["hand", "deck", "damage", "drop", "soul", "bind", "orders", "guardCircle", "gDeck", "gZone", "rideDeck", "removed", "triggerZone"]) (player[zone] || []).forEach((card, index) => add(card, side, zone, index));
    }
    return locations;
  }
  function readSnapshot(match) {
    return {
      locations: readLocations(match),
      vanguards: Object.fromEntries(["human", "bot"].map(side => [side, match?.players?.[side]?.vanguard?.uid || null])),
      damage: Object.fromEntries(["human", "bot"].map(side => [side, match?.players?.[side]?.damage?.length || 0])),
      fields: new Set(fields().map(card => card.dataset.fieldUid)),
      attack: match?.pendingAttack ? { ...match.pendingAttack } : null,
      pendingBattleEnd: match?.pendingBattleEnd ? { ...match.pendingBattleEnd } : null
    };
  }
  function captureBefore() {
    beforeCards.clear();
    const nodes = [...document.querySelectorAll("#match-layout .field-card[data-field-uid], #hand-cards [data-hand-uid]")];
    for (const node of nodes) {
      const uid = node.dataset.fieldUid || node.dataset.handUid;
      if (!uid) continue;
      const rect = node.getBoundingClientRect();
      beforeCards.set(uid, {
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        zone: node.dataset.zone || "hand", side: node.dataset.side || "human",
        power: node.querySelector(".field-card-stats b")?.textContent || "",
        ghost: node.matches(".field-card") ? node.cloneNode(true) : null
      });
    }
  }
  function transientClass(element, name, duration = 760) {
    const oldTimer = activeTimers.get(element); if (oldTimer) clearTimeout(oldTimer);
    element.classList.remove(name); void element.offsetWidth; element.classList.add(name);
    const timer = setTimeout(() => { element.classList.remove(name); activeTimers.delete(element); }, duration);
    activeTimers.set(element, timer);
  }
  function moveIntoField(element, origin, name = "arena-card-call") {
    if (!origin || !element.animate) { transientClass(element, name); return; }
    const target = element.getBoundingClientRect(), dx = origin.left - target.left, dy = origin.top - target.top;
    transientClass(element, name, 620);
    element.animate([
      { translate: `${dx}px ${dy}px`, scale: ".68", opacity: .35, filter: "brightness(1.7)" },
      { translate: "0 0", scale: "1.035", opacity: 1, filter: "brightness(1.12)", offset: .78 },
      { translate: "0 0", scale: "1", opacity: 1, filter: "brightness(1)" }
    ], { duration: name === "arena-card-ride" || name === "arena-card-stride" ? 720 : 520, easing: "cubic-bezier(.18,.82,.22,1)" });
  }
  function ghostRetire(origin) {
    if (!origin?.ghost || !origin.rect.width) return;
    const ghost = origin.ghost;
    ghost.removeAttribute("data-field-uid"); ghost.removeAttribute("data-card-id"); ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, { position: "fixed", left: `${origin.rect.left}px`, top: `${origin.rect.top}px`, width: `${origin.rect.width}px`, height: `${origin.rect.height}px`, margin: "0", zIndex: "15000", pointerEvents: "none" });
    ghost.classList.add("arena-retire-ghost"); document.body.appendChild(ghost);
    const animation = ghost.animate([{ opacity: 1, scale: 1, rotate: "0deg", filter: "brightness(1)" }, { opacity: .65, scale: .88, rotate: "-5deg", filter: "brightness(1.8)" }, { opacity: 0, scale: .5, rotate: "8deg", filter: "brightness(2.5)" }], { duration: 480, easing: "ease-in", fill: "forwards" });
    animation.onfinish = () => ghost.remove(); animation.oncancel = () => ghost.remove();
  }
  function effectAt(element, name) { if (element) transientClass(element, name, 720); }
  function targetForAttack(attack) {
    if (!attack) return null;
    return document.querySelector(`#match-layout .field-card[data-field-uid="${CSS.escape(String(attack.targetUid || ""))}"]`)
      || document.querySelector(`#match-layout .field-zone[data-side="${CSS.escape(String(attack.defenderSide || ""))}"][data-zone="${CSS.escape(String(attack.targetZone || ""))}"]`);
  }
  function afterRender(match) {
    if (!match) { previous = null; beforeCards.clear(); return; }
    const current = readSnapshot(match), currentNodes = fields();
    if (!previous) { previous = current; beforeCards.clear(); return; }

    for (const node of currentNodes) {
      const uid = node.dataset.fieldUid, now = current.locations.get(uid), was = previous.locations.get(uid), origin = beforeCards.get(uid);
      if (!uid || !now) continue;
      if (!previous.fields.has(uid) && was?.zone !== "vanguard") {
        if (now.zone === "vanguard") {
          const stride = Boolean(match.players?.[now.side]?.vanguard?.strideHeart);
          moveIntoField(node, origin, stride ? "arena-card-stride" : "arena-card-ride");
          effectAt(document.querySelector(`.field-zone[data-side="${now.side}"][data-zone="vanguard"]`), stride ? "arena-stride-circle" : "arena-ride-circle");
        } else if (was?.zone !== now.zone || was?.zone === "hand" || !was) moveIntoField(node, origin, "arena-card-call");
      } else if (was && (was.zone !== now.zone || was.side !== now.side)) {
        moveIntoField(node, origin, "arena-card-move");
      }
      const oldPower = origin?.power, newPower = node.querySelector(".field-card-stats b")?.textContent || "";
      if (oldPower && newPower && oldPower !== newPower) {
        const oldNumber = Number(oldPower.replace(/[^0-9-]/g, "")), newNumber = Number(newPower.replace(/[^0-9-]/g, ""));
        effectAt(node.querySelector(".field-card-stats b"), Number.isFinite(oldNumber) && newNumber < oldNumber ? "arena-power-down" : "arena-power-up");
      }
    }

    for (const [uid, oldLocation] of previous.locations) {
      if (!previous.fields.has(uid) || current.fields.has(uid)) continue;
      const next = current.locations.get(uid);
      if (next?.zone === "drop") ghostRetire(beforeCards.get(uid));
    }

    const attack = current.attack, oldAttack = previous.attack;
    if (attack?.battleId && attack.battleId !== oldAttack?.battleId) {
      const attacker = document.querySelector(`#match-layout .field-card[data-field-uid="${CSS.escape(String(attack.attackerUid || ""))}"]`);
      effectAt(attacker, "arena-attack-lunge");
    }
    if (oldAttack?.battleId && !attack && current.pendingBattleEnd?.battleId === oldAttack.battleId) {
      const didHit = current.damage[oldAttack.defenderSide] > previous.damage[oldAttack.defenderSide]
        || (oldAttack.targetZone !== "vanguard" && !current.fields.has(oldAttack.targetUid));
      effectAt(targetForAttack(oldAttack), didHit ? "arena-attack-impact" : "arena-guard-impact");
    }

    previous = current;
    beforeCards.clear();
  }
  window.VanguardArenaVisualEffects = Object.freeze({ beforeRender: captureBefore, afterRender });
})();
