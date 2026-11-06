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
