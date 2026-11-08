"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Projection = require("./match-state-projection.js");

const sql = fs.readFileSync("supabase/match-authority-v6.sql", "utf8");
const getState = sql.slice(
  sql.indexOf("CREATE OR REPLACE FUNCTION public.get_match_state_for_player"),
  sql.indexOf("REVOKE ALL ON FUNCTION public.get_match_state_for_player")
);

test("v6 seat snapshot keeps an effect choice only for its chooser", () => {
  assert.match(getState, /SECURITY DEFINER SET search_path = ''/);
  assert.match(getState, /pending := projected->'pendingEffectChoice'/);
  assert.match(getState, /jsonb_typeof\(pending\) = 'object' AND coalesce\(pending->>'chooserSide', ''\) <> own_side/);
  assert.match(getState, /jsonb_set\(projected, '\{pendingEffectChoice\}', 'null'::jsonb, true\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_match_state_for_player\(text\) TO authenticated/);

  const state = {
    players: { human: { playerId: "host" }, bot: { playerId: "guest" } },
    pendingEffectChoice: { chooserSide: "bot", chooserPlayerId: "guest", sourceCardInstanceId: "source" }
  };
  const hostView = Projection.projectForPlayer(state, "host");
  const guestView = Projection.projectForPlayer(state, "guest");
  assert.equal(hostView.pendingEffectChoice, null, "non-chooser projection must hide the choice");
  assert.equal(guestView.pendingEffectChoice.chooserPlayerId, "guest", "chooser projection retains the choice");
});

test("v6 seat snapshot recursively redacts opponent face-down Equip Gauges without changing public linkage", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.redact_match_equip_gauge_projection\(p_value jsonb, p_side text, p_parent_key text\)/);
  assert.match(sql, /LANGUAGE plpgsql IMMUTABLE SET search_path = ''/);
  assert.match(getState, /opponent := public\.redact_match_equip_gauge_projection\(opponent, opponent_side, NULL\)/);
  assert.match(sql, /p_parent_key, ''\) ~\* 'equip\(ped\)\?\[_ -\]\?gauges\?'/);
  assert.match(sql, /item->>'faceUp' = 'true' OR item->>'faceDown' = 'false'/);
  assert.match(sql, /'attachedToInstanceId', item->'attachedToInstanceId'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.redact_match_equip_gauge_projection\(jsonb, text, text\) FROM PUBLIC, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.redact_match_equip_gauge_projection/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_match_state_for_player\(text\) TO authenticated/);

  const state = {
    players: {
      human: { playerId: "host", vanguard: { uid: "host-vg", equipGauges: [{ uid: "host-gauge", cardId: "host-secret", faceDown: true, attachedToInstanceId: "host-vg" }] } },
      bot: { playerId: "guest", vanguard: { uid: "guest-vg", equipGauges: [
        { uid: "guest-gauge", cardId: "guest-secret", faceDown: true, attachedToInstanceId: "guest-vg" },
        { uid: "guest-face-up-gauge", cardId: "guest-public", faceUp: true, attachedToInstanceId: "guest-vg" }
      ] } }
    }
  };
  const hostView = Projection.projectForPlayer(state, "host");
  const guestView = Projection.projectForPlayer(state, "guest");
  assert.equal(hostView.players.bot.vanguard.equipGauges.length, 2);
  assert.equal(hostView.players.bot.vanguard.equipGauges[0].cardId, null);
  assert.equal(hostView.players.bot.vanguard.equipGauges[0].attachedToInstanceId, "guest-vg");
  assert.equal(hostView.players.bot.vanguard.equipGauges[1].cardId, "guest-public");
  assert.equal(guestView.players.human.vanguard.equipGauges[0].cardId, null);
  assert.equal(guestView.players.bot.vanguard.equipGauges[0].cardId, "guest-secret", "gauge owners retain their identities");
});
