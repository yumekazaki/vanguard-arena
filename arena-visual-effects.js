/* Client-only animation layer. It observes rendered match state but never changes game state or actions. */
(() => {
  "use strict";
  const beforeCards = new Map();
  const deckOrigins = new Map();
  let previous = null;
  let phaseBannerTimer = null;
  const activeTimers = new WeakMap();

  function reducedMotionEnabled() {
    return window.VanguardAnimationSettings?.getMode() === "reduced"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

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
      matchId: match?.matchId || null,
      phase: Number(match?.phase ?? -1),
      side: match?.side || null,
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
    deckOrigins.clear();
    for (const side of ["human", "bot"]) {
      const deck = document.querySelector(`.${side === "human" ? "human" : "opponent"}-line .deck-zone`);
      const rect = deck?.getBoundingClientRect();
      if (rect?.width && rect?.height) deckOrigins.set(side, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
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
    if (reducedMotionEnabled()) return;
    duration = window.VanguardAnimationSettings?.duration(duration) ?? duration;
    const oldTimer = activeTimers.get(element); if (oldTimer) clearTimeout(oldTimer);
    element.classList.remove(name); void element.offsetWidth; element.classList.add(name);
    const timer = setTimeout(() => { element.classList.remove(name); activeTimers.delete(element); }, duration);
    activeTimers.set(element, timer);
  }
  function moveIntoField(element, origin, name = "arena-card-call") {
    if (reducedMotionEnabled()) return;
    if (!origin || !element.animate) { transientClass(element, name); return; }
    const target = element.getBoundingClientRect(), dx = origin.left - target.left, dy = origin.top - target.top;
    transientClass(element, name, 620);
    element.animate([
      { translate: `${dx}px ${dy}px`, scale: ".68", opacity: .35, filter: "brightness(1.7)" },
      { translate: "0 0", scale: "1.035", opacity: 1, filter: "brightness(1.12)", offset: .78 },
      { translate: "0 0", scale: "1", opacity: 1, filter: "brightness(1)" }
    ], { duration: window.VanguardAnimationSettings?.duration(name === "arena-card-ride" || name === "arena-card-stride" ? 720 : 520) ?? (name === "arena-card-ride" || name === "arena-card-stride" ? 720 : 520), easing: "cubic-bezier(.18,.82,.22,1)" });
  }
  function ghostRetire(origin) {
    if (reducedMotionEnabled()) return;
    if (!origin?.ghost || !origin.rect.width) return;
    const ghost = origin.ghost;
    ghost.removeAttribute("data-field-uid"); ghost.removeAttribute("data-card-id"); ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, { position: "fixed", left: `${origin.rect.left}px`, top: `${origin.rect.top}px`, width: `${origin.rect.width}px`, height: `${origin.rect.height}px`, margin: "0", zIndex: "15000", pointerEvents: "none" });
    ghost.classList.add("arena-retire-ghost"); document.body.appendChild(ghost);
    const animation = ghost.animate([{ opacity: 1, scale: 1, rotate: "0deg", filter: "brightness(1)" }, { opacity: .65, scale: .88, rotate: "-5deg", filter: "brightness(1.8)" }, { opacity: 0, scale: .5, rotate: "8deg", filter: "brightness(2.5)" }], { duration: 480, easing: "ease-in", fill: "forwards" });
    animation.onfinish = () => ghost.remove(); animation.oncancel = () => ghost.remove();
  }
  function effectAt(element, name) { if (element) transientClass(element, name, 720); }
  function animateDraw(side, origin, uid, sequence = 0) {
    const destination = side === "human"
      ? document.querySelector("#open-hand")
      : document.querySelector(".opponent-hand-row");
    if (!destination) return;
    const target = destination.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const arrival = side === "human" ? destination : document.querySelector("#bot-hand");
    effectAt(arrival, "arena-draw-arrival");
    if (!origin || !origin.width || !origin.height) return;

    const isOwnerDraw = side === "human";
    const handCard = isOwnerDraw
      ? document.querySelector(`#hand-cards [data-hand-uid="${CSS.escape(String(uid))}"] .game-card`)
      : null;
    const sourceImage = handCard?.querySelector(".card-art img");
    const cardName = handCard?.querySelector(".card-name")?.textContent?.trim() || sourceImage?.alt || "Drawn card";
    const imageSrc = sourceImage?.getAttribute("src") || "";
    const width = isOwnerDraw ? Math.min(168, Math.max(122, window.innerWidth * .36)) : 46;
    const height = isOwnerDraw ? width * 1.46 : 66;
    const startX = origin.left + (origin.width - width) / 2;
    const startY = origin.top + (origin.height - height) / 2;
    const flight = document.createElement("div");
    flight.className = `arena-draw-flight${isOwnerDraw ? " is-revealing" : " is-back-only"}`;
    flight.setAttribute("aria-hidden", "true");
    const inner = document.createElement("div");
    inner.className = "arena-draw-flight-inner";
    const back = document.createElement("div");
    back.className = "arena-draw-back";
    const logo = document.createElement("span");
    logo.textContent = "V";
    back.append(logo);
    inner.append(back);
    if (isOwnerDraw) {
      const front = document.createElement("div");
      front.className = "arena-draw-front";
      if (imageSrc) {
        const image = document.createElement("img");
        image.src = imageSrc;
        image.alt = "";
        front.append(image);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "arena-draw-fallback";
        fallback.textContent = cardName;
        front.append(fallback);
      }
      const name = document.createElement("b");
      name.className = "arena-draw-name";
      name.textContent = cardName;
      front.append(name);
      inner.append(front);
    }
    flight.append(inner);
    Object.assign(flight.style, { left: `${startX}px`, top: `${startY}px` });
    document.body.appendChild(flight);
    if (isOwnerDraw) {
      const centerX = window.innerWidth / 2 - width / 2 + sequence * 14;
      const centerY = window.innerHeight / 2 - height / 2 + sequence * 12;
      const toCenterX = centerX - startX, toCenterY = centerY - startY;
      if (reducedMotionEnabled() || !flight.animate || !inner.animate) {
        flight.classList.add("is-face-up", "is-static");
        flight.style.left = `${centerX}px`;
        flight.style.top = `${centerY}px`;
        setTimeout(() => flight.remove(), window.VanguardAnimationSettings?.duration(1300) ?? 1300);
        return;
      }
      const arrive = flight.animate([
        { transform: "translate(0,0) rotate(-8deg) scale(.25)", opacity: .1 },
        { transform: `translate(${toCenterX}px,${toCenterY}px) rotate(0deg) scale(1)`, opacity: 1 }
      ], { duration: window.VanguardAnimationSettings?.duration(480) ?? 480, delay: sequence * 140, easing: "cubic-bezier(.18,.82,.22,1)", fill: "forwards" });
      arrive.onfinish = () => {
        const flip = inner.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], {
          duration: window.VanguardAnimationSettings?.duration(480) ?? 480,
          easing: "cubic-bezier(.25,.75,.25,1)", fill: "forwards"
        });
        flip.onfinish = () => setTimeout(() => {
          const currentTarget = destination.getBoundingClientRect();
          const toHandX = currentTarget.left + currentTarget.width / 2 - (centerX + width / 2);
          const toHandY = currentTarget.top + currentTarget.height / 2 - (centerY + height / 2);
          const collect = flight.animate([
            { transform: `translate(${toCenterX}px,${toCenterY}px) scale(1)`, opacity: 1 },
            { transform: `translate(${toCenterX + toHandX}px,${toCenterY + toHandY}px) scale(.2)`, opacity: .08 }
          ], { duration: window.VanguardAnimationSettings?.duration(440) ?? 440, easing: "cubic-bezier(.35,0,.7,.35)" });
          collect.onfinish = () => flight.remove();
          collect.oncancel = () => flight.remove();
        }, window.VanguardAnimationSettings?.duration(850) ?? 850);
        flip.oncancel = () => flight.remove();
      };
      arrive.oncancel = () => flight.remove();
      return;
    }

    if (reducedMotionEnabled() || !flight.animate) { flight.remove(); return; }
    const dx = target.left + target.width / 2 - (startX + width / 2);
    const dy = target.top + target.height / 2 - (startY + height / 2);
    const animation = flight.animate([
      { transform: "translate(0,0) rotate(-9deg) scale(.68)", opacity: 0 },
      { transform: `translate(${dx * .5}px,${dy * .5}px) rotate(5deg) scale(1)`, opacity: 1, offset: .58 },
      { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(.28)`, opacity: .12 }
    ], { duration: window.VanguardAnimationSettings?.duration(520) ?? 520, delay: sequence * 100, easing: "cubic-bezier(.2,.78,.25,1)" });
    animation.onfinish = () => flight.remove();
    animation.oncancel = () => flight.remove();
  }
  function showPhaseBanner(match) {
    const panel = document.querySelector("#phase-transition-flash");
    if (!panel) return;
    const phases = ["Stand", "Draw", "Ride", "Stride", "Main", "Battle", "End"];
    const phase = phases[Number(match.phase)] || "Next";
    const sideName = match.side === "human" ? "Your" : (match.players?.[match.side]?.name || "Opponent") + "’s";
    panel.querySelector("b").textContent = `${sideName} ${phase} Phase`;
    const duration = window.VanguardAnimationSettings?.duration(1050) ?? 1050;
    panel.hidden = false;
    panel.classList.remove("show");
    panel.style.animationDuration = reducedMotionEnabled() ? "" : `${duration}ms`;
    if (!reducedMotionEnabled()) { void panel.offsetWidth; panel.classList.add("show"); }
    if (phaseBannerTimer) clearTimeout(phaseBannerTimer);
    phaseBannerTimer = setTimeout(() => { panel.hidden = true; panel.classList.remove("show"); phaseBannerTimer = null; }, duration);
  }
  function targetForAttack(attack) {
    if (!attack) return null;
    return document.querySelector(`#match-layout .field-card[data-field-uid="${CSS.escape(String(attack.targetUid || ""))}"]`)
      || document.querySelector(`#match-layout .field-zone[data-side="${CSS.escape(String(attack.defenderSide || ""))}"][data-zone="${CSS.escape(String(attack.targetZone || ""))}"]`);
  }
  function afterRender(match) {
    if (!match) { previous = null; beforeCards.clear(); return; }
    const current = readSnapshot(match), currentNodes = fields();
    if (!previous) { previous = current; beforeCards.clear(); return; }
    if (current.matchId === previous.matchId && (current.phase !== previous.phase || current.side !== previous.side)) showPhaseBanner(match);

    let drawSequence = 0;
    for (const [uid, was] of previous.locations) {
      const now = current.locations.get(uid);
      if (was?.zone === "deck" && now?.zone === "hand" && was.side === now.side) animateDraw(now.side, deckOrigins.get(now.side), uid, drawSequence++);
    }

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
