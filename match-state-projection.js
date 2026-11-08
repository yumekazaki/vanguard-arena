"use strict";

(function attachMatchStateProjection(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchStateProjection = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchStateProjection() {
  const PRIVATE_ZONES = Object.freeze(["hand", "deck", "gDeck"]);
  const OWNER_ONLY_PENDING = Object.freeze(["pendingAbility", "pendingEffectChoice", "pendingStride", "pendingProtectGuard", "pendingTrigger", "pendingCrest", "pendingGAssist"]);

  function hidePrivateZones(match, sides, zones = PRIVATE_ZONES) {
    if (!match || !match.players || !Array.isArray(sides) || !Array.isArray(zones)) return match;
    if (match.revealed?.private && sides.includes(match.revealed.owner)) match.revealed = null;
    for (const side of sides) {
      const player = match.players[side];
      if (!player) continue;
      redactFaceDownEquipGaugeArrays(player, side);
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

  function isFaceDownGauge(card) {
    if (!card || typeof card !== "object") return true;
    return card.faceUp !== true && card.faceUp !== "true" && card.faceDown !== false && card.faceDown !== "false";
  }

  function hiddenGaugeCard(card, side, index, gaugeField) {
    const attachedToInstanceId = card && typeof card === "object" && Object.prototype.hasOwnProperty.call(card, "attachedToInstanceId")
      ? card.attachedToInstanceId
      : undefined;
    const attachmentKey = attachedToInstanceId == null ? "unattached" : String(attachedToInstanceId);
    const fieldKey = String(gaugeField || "gauge").replace(/[^a-zA-Z0-9_-]/g, "_");
    const hidden = {
      uid: `hidden-${side}-${fieldKey}-${attachmentKey}-${index}`,
      cardId: null,
      faceDown: true
    };
    if (attachedToInstanceId !== undefined) hidden.attachedToInstanceId = attachedToInstanceId;
    return hidden;
  }

  function redactFaceDownEquipGaugeArrays(value, side, parentKey = "") {
    if (Array.isArray(value)) {
      if (/equip(?:ped)?[_\s-]?gauges?/i.test(parentKey)) {
        return value.map((card, index) => isFaceDownGauge(card)
          ? hiddenGaugeCard(card, side, index, parentKey)
          : redactFaceDownEquipGaugeArrays(card, side));
      }
      for (let index = 0; index < value.length; index += 1) {
        value[index] = redactFaceDownEquipGaugeArrays(value[index], side);
      }
      return value;
    }
    if (!value || typeof value !== "object") return value;
    for (const key of Object.keys(value)) {
      value[key] = redactFaceDownEquipGaugeArrays(value[key], side, key);
    }
    return value;
  }

  function pendingOwnerSide(key, value) {
    if (!value || typeof value !== "object") return null;
    if (key === "pendingAbility") return value.side || null;
    if (key === "pendingEffectChoice") return value.chooserSide || null;
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
      if (projected[key] && (!owner || owner !== ownSide)) projected[key] = null;
    }
    if (Array.isArray(projected.pendingAbilities)) {
      projected.pendingAbilities = projected.pendingAbilities.filter(item => {
        const owner = item?.side || Object.keys(projected.players).find(side => projected.players[side]?.playerId === item?.triggerControllerPlayerId);
        return owner === ownSide;
      });
    }
    return projected;
  }

  return Object.freeze({ PRIVATE_ZONES, OWNER_ONLY_PENDING, hidePrivateZones, redactFaceDownEquipGaugeArrays, sideForPlayer, projectForPlayer });
});
