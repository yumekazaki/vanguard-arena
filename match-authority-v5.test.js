"use strict";
const test = require("node:test");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const sql = fs.readFileSync("supabase/match-authority-v5.sql", "utf8");

test("player state RPC verifies a seated identity and redacts opponent private zones", () => {
  const getState = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.get_match_state_for_player"), sql.indexOf("CREATE OR REPLACE FUNCTION public.get_match_action_result"));
  assert.match(getState, /auth\.uid\(\) IS NULL/);
  assert.match(getState, /auth\.uid\(\) IS DISTINCT FROM room\.host_auth_uid AND auth\.uid\(\) IS DISTINCT FROM room\.guest_auth_uid/);
  assert.match(getState, /own_side := CASE WHEN auth\.uid\(\) = room\.host_auth_uid THEN 'human' ELSE 'bot' END/);
  assert.match(getState, /ARRAY\['hand','deck','gDeck'\]/);
  assert.match(getState, /redact_match_card_array\(opponent -> \(zone_name\), opponent_side, zone_name, true\)/);
  assert.match(getState, /opponent->'damage'.*false/s);
  assert.match(getState, /pendingAbility','pendingStride','pendingProtectGuard','pendingTrigger','pendingCrest','pendingGAssist/);
  assert.match(getState, /triggerControllerPlayerId/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_match_state_for_player\(text\) TO authenticated/);
});

test("command-result RPC returns only the requesting player's own action result", () => {
  const getResult = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.get_match_action_result"));
  assert.match(getResult, /auth\.uid\(\) IS DISTINCT FROM room\.host_auth_uid AND auth\.uid\(\) IS DISTINCT FROM room\.guest_auth_uid/);
  assert.match(getResult, /action_id = p_action_id AND actor_auth_uid = auth\.uid\(\)/);
  assert.match(getResult, /'status', command\.status/);
  assert.match(getResult, /'result', command\.result/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_match_action_result\(text, text\) TO authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_match_action_result\(text, text\) FROM PUBLIC, anon/);
});

test("private redaction helper cannot be called directly by browser roles", () => {
  assert.match(sql, /redact_match_card_array\(p_cards jsonb, p_side text, p_zone text, p_hide_all boolean\)/);
  assert.match(sql, /'hidden-' \|\| p_side \|\| '-' \|\| p_zone/);
  assert.match(sql, /p_hide_all OR item->>'faceDown' = 'true'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.redact_match_card_array\(jsonb, text, text, boolean\) FROM PUBLIC, anon, authenticated, service_role/);
});
