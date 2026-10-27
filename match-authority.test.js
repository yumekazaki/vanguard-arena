"use strict";
const test=require("node:test");
const fs=require("node:fs");
const assert=require("node:assert/strict");

const sql=fs.readFileSync("supabase/match-authority-v1.sql","utf8");

test("canonical state and queued action data are private to the trusted worker",()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.match_game_states[\s\S]*?state_version bigint NOT NULL DEFAULT 0[\s\S]*?state jsonb NOT NULL[\s\S]*?pending_action_id text/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.match_action_commands[\s\S]*?actor_auth_uid uuid NOT NULL REFERENCES auth\.users\(id\)[\s\S]*?expected_state_version bigint NOT NULL[\s\S]*?PRIMARY KEY \(room_code, action_id\)/);
 assert.match(sql,/ALTER TABLE public\.match_game_states ENABLE ROW LEVEL SECURITY/);assert.match(sql,/ALTER TABLE public\.match_action_commands ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.match_game_states FROM PUBLIC, anon, authenticated/);assert.match(sql,/REVOKE ALL ON TABLE public\.match_action_commands FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT ALL ON TABLE public\.match_game_states TO service_role/);assert.match(sql,/GRANT ALL ON TABLE public\.match_action_commands TO service_role/);
});

test("command submission binds identity to a seated auth user and serializes versioned actions",()=>{
 const submit=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.submit_match_action"),sql.indexOf("CREATE OR REPLACE FUNCTION public.complete_match_action"));
 assert.match(submit,/auth\.uid\(\) IS NULL/);assert.match(submit,/auth\.uid\(\) IS DISTINCT FROM room\.host_auth_uid AND auth\.uid\(\) IS DISTINCT FROM room\.guest_auth_uid/);
 assert.match(submit,/p_payload \?\| ARRAY\['actorPlayerId', 'actorAuthUid', 'matchId', 'expectedStateVersion', 'actionId'\]/);
 assert.match(submit,/SELECT \* INTO canonical FROM public\.match_game_states WHERE room_code = room\.room_code FOR UPDATE/);
 assert.match(submit,/canonical\.pending_action_id IS NOT NULL/);assert.match(submit,/canonical\.state_version <> p_expected_state_version/);
 assert.match(submit,/INSERT INTO public\.match_action_commands/);assert.match(submit,/SET pending_action_id = p_action_id/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.submit_match_action\(text, text, bigint, jsonb\) TO authenticated/);
});

test("only the trusted worker can initialize state and commit or reject a command",()=>{
 const initialize=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.initialize_match_game_state"),sql.indexOf("CREATE OR REPLACE FUNCTION public.submit_match_action"));
 const complete=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.complete_match_action"));
 assert.match(initialize,/auth\.role\(\).*service_role/);assert.match(initialize,/host_auth_uid IS NULL OR room\.guest_auth_uid IS NULL/);
 assert.match(complete,/auth\.role\(\).*service_role/);assert.match(complete,/canonical\.pending_action_id IS DISTINCT FROM p_action_id/);
 assert.match(complete,/state_version = state_version \+ 1/);assert.match(complete,/CASE WHEN p_accepted THEN 'accepted' ELSE 'rejected' END/);
 assert.match(complete,/REVOKE ALL ON FUNCTION public\.complete_match_action\(text, text, boolean, jsonb, jsonb\) FROM PUBLIC, anon, authenticated/);
});

test("authority v2 leases each queued command to one trusted worker and rejects stale lease completion",()=>{
 const sqlV2=fs.readFileSync("supabase/match-authority-v2.sql","utf8");
 assert.match(sqlV2,/ADD COLUMN IF NOT EXISTS worker_claim_token uuid/);assert.match(sqlV2,/ADD COLUMN IF NOT EXISTS worker_lease_expires_at timestamptz/);
 const claim=sqlV2.slice(sqlV2.indexOf("CREATE OR REPLACE FUNCTION public.claim_match_action"),sqlV2.indexOf("DROP FUNCTION IF EXISTS public.complete_match_action"));
 assert.match(claim,/auth\.role\(\).*service_role/);assert.match(claim,/FOR UPDATE/);assert.match(claim,/worker_lease_expires_at > now\(\)/);assert.match(claim,/worker_claim_token = lease_token/);assert.match(claim,/actorAuthUid', command\.actor_auth_uid/);assert.match(claim,/state', canonical\.state/);
 const complete=sqlV2.slice(sqlV2.indexOf("CREATE OR REPLACE FUNCTION public.complete_match_action"));
 assert.match(complete,/p_claim_token uuid/);assert.match(complete,/worker_claim_token IS DISTINCT FROM p_claim_token/);assert.match(complete,/worker_lease_expires_at <= now\(\)/);assert.match(complete,/state_version = state_version \+ 1/);
 assert.match(sqlV2,/GRANT EXECUTE ON FUNCTION public\.claim_match_action\(text, integer\) TO service_role/);assert.match(sqlV2,/REVOKE ALL ON FUNCTION public\.claim_match_action\(text, integer\) FROM PUBLIC, anon, authenticated/);
});

test("authority v3 stores private deck submissions by authenticated seat and locks both before initialization",()=>{
 const sqlV3=fs.readFileSync("supabase/match-authority-v3.sql","utf8");
 assert.match(sqlV3,/CREATE TABLE IF NOT EXISTS public\.match_deck_submissions[\s\S]*?player_auth_uid uuid NOT NULL REFERENCES auth\.users\(id\)[\s\S]*?deck jsonb NOT NULL[\s\S]*?locked_for_match boolean NOT NULL DEFAULT false[\s\S]*?PRIMARY KEY \(room_code, player_auth_uid\)/);
 assert.match(sqlV3,/ALTER TABLE public\.match_deck_submissions ENABLE ROW LEVEL SECURITY/);
 assert.match(sqlV3,/REVOKE ALL ON TABLE public\.match_deck_submissions FROM PUBLIC, anon, authenticated/);
 assert.match(sqlV3,/GRANT ALL ON TABLE public\.match_deck_submissions TO service_role/);
 const submit=sqlV3.slice(sqlV3.indexOf("CREATE OR REPLACE FUNCTION public.submit_match_deck"),sqlV3.indexOf("CREATE OR REPLACE FUNCTION public.claim_match_decks_for_initialization"));
 assert.match(submit,/VALUES \(room\.room_code, auth\.uid\(\), p_deck\)/);
 assert.match(submit,/auth\.uid\(\) IS DISTINCT FROM room\.host_auth_uid AND auth\.uid\(\) IS DISTINCT FROM room\.guest_auth_uid/);
 assert.match(submit,/jsonb_each\(p_deck->'cards'\)/);assert.match(submit,/locked_for_match = false/);assert.match(submit,/match_game_states/);
 assert.match(sqlV3,/GRANT EXECUTE ON FUNCTION public\.submit_match_deck\(text, jsonb\) TO authenticated/);
 const claim=sqlV3.slice(sqlV3.indexOf("CREATE OR REPLACE FUNCTION public.claim_match_decks_for_initialization"));
 assert.match(claim,/auth\.role\(\).*service_role/);assert.match(claim,/room\.host_auth_uid/);assert.match(claim,/room\.guest_auth_uid/);
 assert.match(claim,/SET locked_for_match = true/);assert.match(claim,/hostDeck', host_deck/);assert.match(claim,/guestDeck', guest_deck/);
 assert.match(sqlV3,/REVOKE ALL ON FUNCTION public\.claim_match_decks_for_initialization\(text\) FROM PUBLIC, anon, authenticated/);
 assert.match(sqlV3,/GRANT EXECUTE ON FUNCTION public\.claim_match_decks_for_initialization\(text\) TO service_role/);
});
