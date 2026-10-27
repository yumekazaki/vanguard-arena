import "../../../ability-engine.js";
import "../../../match-bootstrap.js";
import "../../../match-initializer.js";
import "../match-worker/worker-core.js";
import "./worker-core.js";

type Runtime = typeof globalThis & {
  VanguardAbilityEngine: Record<string, unknown>;
  VanguardMatchBootstrap: Record<string, unknown>;
  VanguardMatchInitializer: { initializeRoom: (...args: unknown[]) => Promise<Record<string, unknown>> };
  VanguardMatchInitializerWorker: { initializeRoom: (...args: unknown[]) => Promise<Record<string, unknown>> };
  VanguardMatchWorkerCore: { validateCanonicalMatchState: (...args: unknown[]) => Record<string, unknown> };
};
const runtime = globalThis as Runtime;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store"
};

async function rpc(name: string, args: Record<string, unknown>, url: string, serviceKey: string) {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { "content-type": "application/json", apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, body: JSON.stringify(args)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`RPC ${name} failed`);
  return body ? JSON.parse(body) : null;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ ok: false, reason: "method-not-allowed" }, { status: 405, headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !anonKey) return Response.json({ ok: false, reason: "initializer-not-configured" }, { status: 503, headers: corsHeaders });
  if (!authorization?.startsWith("Bearer ")) return Response.json({ ok: false, reason: "authentication-required" }, { status: 401, headers: corsHeaders });

  let auth: { id?: string };
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
    if (!response.ok) return Response.json({ ok: false, reason: "authentication-required" }, { status: 401, headers: corsHeaders });
    auth = await response.json();
  } catch { return Response.json({ ok: false, reason: "authentication-unavailable" }, { status: 503, headers: corsHeaders }); }

  let roomCode: unknown;
  try { roomCode = (await request.json())?.roomCode; } catch { return Response.json({ ok: false, reason: "invalid-json" }, { status: 400, headers: corsHeaders }); }
  if (typeof roomCode !== "string" || !/^[A-Fa-f0-9]{16}$/.test(roomCode)) return Response.json({ ok: false, reason: "invalid-room-code" }, { status: 400, headers: corsHeaders });

  const normalizedCode = roomCode.toUpperCase();
  const readRoomSeats = async (code: string) => {
    const query = new URLSearchParams({ room_code: `eq.${code.toUpperCase()}`, select: "host_auth_uid,guest_auth_uid" });
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/match_rooms?${query}`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
    if (!response.ok) throw new Error("Room lookup failed");
    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] || null : null;
  };

  try {
    const result = await runtime.VanguardMatchInitializerWorker.initializeRoom(normalizedCode, auth.id || "", {
      rpc: (name: string, args: Record<string, unknown>) => rpc(name, args, url, serviceKey),
      readRoomSeats,
      initializer: runtime.VanguardMatchInitializer,
      cardDefinitions: (ids: string[]) => rpc("get_match_card_definitions", { p_card_ids: ids }, url, serviceKey),
      bootstrap: runtime.VanguardMatchBootstrap,
      engine: runtime.VanguardAbilityEngine,
      validateCanonicalMatchState: runtime.VanguardMatchWorkerCore.validateCanonicalMatchState
    });
    return Response.json(result, { status: result.ok ? 200 : 409, headers: corsHeaders });
  } catch { return Response.json({ ok: false, reason: "match-initialization-failed" }, { status: 409, headers: corsHeaders }); }
});
