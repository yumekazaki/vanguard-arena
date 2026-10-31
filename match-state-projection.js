"use strict";

(function attachMatchStateProjection(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchStateProjection = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchStateProjection() {
  const PRIVATE_ZONES = Object.freeze(["hand", "deck", "gDeck"]);
  const OWNER_ONLY_PENDING = Object.freeze(["pendingAbility", "pendingStride", "pendingProtectGuard", "pendingTrigger", "pendingCrest", "pendingGAssist"]);

  function hidePrivateZones(match, sides, zones = PRIVATE_ZONES) {
    if (!match || !match.players || !Array.isArray(sides) || !Array.isArray(zones)) return match;
    if (match.revealed?.private && sides.includes(match.revealed.owner)) match.revealed = null;
    for (const side of sides) {
      const player = match.players[side];
      if (!player) continue;
      for (const zone of zones) {
        if (!PRIVATE_ZONES.includes(zone) || !Array.isArray(player[zone])) continue;
        player[zone] = player[zone].map((card, index) => zone === "gDeck" && card?.faceUp === true ? card : ({
          uid: `hidden-${side}-${zone}-${index}`,
          cardId: null,
          faceDown: true
        }));
      }
    }
    return match;
  }

  function sideForPlayer(match, playerId) {
    return Object.keys(match?.players || {}).find(side => match.players[side]?.playerId === playerId) || null;
  }

  function redactFaceDownDamage(player, side) {
    if (!Array.isArray(player?.damage)) return;
    player.damage = player.damage.map((card, index) => card?.faceDown === true
      ? { uid: `hidden-${side}-damage-${index}`, cardId: null, faceDown: true }
      : card);
  }

  function pendingOwnerSide(key, value) {
    if (!value || typeof value !== "object") return null;
    if (key === "pendingAbility") return value.side || null;
    if (key === "pendingStride" || key === "pendingProtectGuard") return value.ownerSide || value.side || null;
    return value.side || value.ownerSide || null;
  }

  function projectForPlayer(match, playerId) {
    const ownSide = sideForPlayer(match, playerId);
    if (!ownSide) return null;
    const projected = JSON.parse(JSON.stringify(match));
    const opponentSide = Object.keys(projected.players).find(side => side !== ownSide);
    if (opponentSide) {
      hidePrivateZones(projected, [opponentSide]);
      redactFaceDownDamage(projected.players[opponentSide], opponentSide);
    }
    for (const key of OWNER_ONLY_PENDING) {
      const owner = pendingOwnerSide(key, projected[key]);
      if (owner && owner !== ownSide) projected[key] = null;
    }
    if (Array.isArray(projected.pendingAbilities)) {
      projected.pendingAbilities = projected.pendingAbilities.filter(item => {
        const owner = item?.side || Object.keys(projected.players).find(side => projected.players[side]?.playerId === item?.triggerControllerPlayerId);
        return owner === ownSide;
      });
    }
    return projected;
  }

  return Object.freeze({ PRIVATE_ZONES, OWNER_ONLY_PENDING, hidePrivateZones, sideForPlayer, projectForPlayer });
});
