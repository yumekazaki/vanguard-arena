"use strict";
const test=require("node:test");
const fs=require("node:fs");
const assert=require("node:assert/strict");
const app=fs.readFileSync("app.js","utf8");
const sql=fs.readFileSync("supabase/match-auth-v1.sql","utf8");
const roomsSql=fs.readFileSync("supabase/match-rooms.sql","utf8");
const relay=fs.readFileSync("match-relay.js","utf8");

test("base room migration provides the directory RPCs required by the website and auth migration",()=>{
 assert.match(roomsSql,/CREATE TABLE IF NOT EXISTS public\.match_rooms/);
 assert.match(roomsSql,/CREATE OR REPLACE FUNCTION public\.create_match_room\([\s\S]*?p_password text[\s\S]*?RETURNS void/);
 assert.match(roomsSql,/CREATE OR REPLACE FUNCTION public\.list_match_rooms\(\)[\s\S]*?RETURNS TABLE\(room_code text, room_name text, host_name text\)/);
 assert.match(roomsSql,/CREATE OR REPLACE FUNCTION public\.resolve_match_room\(p_room_code text, p_password text\)[\s\S]*?RETURNS text/);
 assert.match(roomsSql,/extensions\.crypt\(p_password, extensions\.gen_salt\('bf'\)\)/);
 assert.match(roomsSql,/updated_at > now\(\) - interval '10 minutes'/);
 assert.match(roomsSql,/REVOKE ALL ON TABLE public\.match_rooms FROM anon, authenticated/);
 assert.match(roomsSql,/GRANT EXECUTE ON FUNCTION public\.create_match_room\(text, text, text, text, text\) TO authenticated/);
 assert.match(roomsSql,/GRANT EXECUTE ON FUNCTION public\.resolve_match_room\(text, text\) TO anon, authenticated/);
 assert.ok(fs.existsSync("supabase/SETUP.md"));
});

test("online player rooms use separate anonymous auth sessions and authenticated room claims",()=>{
 assert.match(app,/storageKey: "vanguard-arena-match-session"/);
 assert.match(app,/auth.signInAnonymously()/);
 assert.ok(app.includes("account.matchClient.rpc(\"create_match_room\""));
 assert.match(app,/claim_player_match_room/);
 assert.match(sql,/NEW.host_auth_uid := auth.uid()/);
 assert.match(sql,/SET guest_auth_uid = auth.uid()/);
 assert.match(sql,/room.guest_auth_uid IS NULL OR room.guest_auth_uid = auth.uid()/);
 assert.match(sql,/room.host_auth_uid IS DISTINCT FROM auth.uid()/);
});

test("host and joining player submit only their selected deck to the private seat RPC, without blocking legacy play",()=>{
 const helperStart=app.indexOf("async function registerOnlineDeckForAuthority("),helperEnd=app.indexOf("function renderOnlineDeckChoices(",helperStart),helper=app.slice(helperStart,helperEnd);
 const hostStart=app.indexOf("function beginHosting("),hostEnd=app.indexOf("async function beginJoining(",hostStart),host=app.slice(hostStart,hostEnd);
 const joinStart=app.indexOf("async function beginJoining("),joinEnd=app.indexOf("function ",joinStart+20),join=app.slice(joinStart,joinEnd<0?app.length:joinEnd);
 assert.match(helper,/account\.matchClient\.rpc\("submit_match_deck"/);
 assert.match(helper,/p_room_code: roomCode, p_deck: onlineDeck\(\)/);
 assert.match(helper,/catch \(error\)[\s\S]*?submitted: false/);
 assert.match(host,/create_match_room[\s\S]*?registerOnlineDeckForAuthority\(roomCode\)[\s\S]*?startMatch\(/);
 assert.match(join,/online\.role = watching \? "watcher" : "guest"[\s\S]*?registerOnlineDeckForAuthority\(roomCode\)/);
 assert.match(host,/if \(!authorityDeckStatus\.submitted\) addLog/);
 assert.match(join,/if \(!authorityDeckStatus\.submitted\) setMessage/);
});

test("private relay separates allowed sender directions by authenticated room seat",()=>{
 assert.ok(app.includes("window.VanguardMatchRelay.createConnection"));
 assert.ok(app.includes('role==="guest"?"guest-host":"host-guest"'));

 assert.ok(relay.includes('if (incoming === outgoing) outgoing.subscribe'));
 assert.ok(relay.includes('else { outgoing.subscribe(onStatus("out")); incoming.subscribe(onStatus("in")); }'));
 assert.ok(sql.includes("auth.uid() = room.guest_auth_uid") && sql.includes("guest-host"));
 assert.ok(sql.includes("auth.uid() = room.host_auth_uid") && sql.includes("host-guest"));
 assert.ok(sql.includes("public.can_send_match_relay(realtime.topic())"));
 assert.ok(sql.includes("public.can_read_match_relay(realtime.topic())"));
 assert.ok(sql.includes("REVOKE EXECUTE ON FUNCTION public.touch_match_room(text) FROM anon"));
 assert.ok(sql.includes("REVOKE EXECUTE ON FUNCTION public.close_match_room(text) FROM anon"));
});

test("guest allows one outstanding state-changing request and resyncs without optimistic version changes",()=>{
 const sendStart=app.indexOf("function sendGuestRequest("),sendEnd=app.indexOf("function versionMatchSnapshot(",sendStart),send=app.slice(sendStart,sendEnd),updateStart=app.indexOf("function updateGuestState("),updateEnd=app.indexOf("function handleRemoteMessage(",updateStart),update=app.slice(updateStart,updateEnd),hostStart=app.indexOf("function handleRemoteMessage("),hostEnd=app.indexOf("function bindOnlineConnection(",hostStart),host=app.slice(hostStart,hostEnd);
 assert.match(send,/type !== "select" && online\.remoteRequestPending/);assert.match(send,/online\.remoteRequestPending=actionId/);assert.match(send,/expectedStateVersion/);assert.doesNotMatch(send,/match\.stateVersion\s*=\s*expectedStateVersion\s*\+/);assert.match(send,/type:"sync"/);assert.match(update,/online\.remoteRequestPending=null/);assert.match(host,/message\.type==="sync"\)\{sendOnlineSnapshot\(\);return;/);
});

test("automatic ability prompt queue calls the centralized readiness gate",()=>{
 const start=app.indexOf("function queueOneAbility("),end=app.indexOf("function ",start+20),queue=app.slice(start,end<0?app.length:end);
 assert.ok(start>=0);assert.match(queue,/autoAbilityReadiness\(ability\)\.ok/);
 assert.ok(queue.indexOf("autoAbilityReadiness(ability)")<queue.indexOf("pendingAbilities"));
});
