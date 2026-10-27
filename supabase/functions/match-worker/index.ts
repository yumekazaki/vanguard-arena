import "../../../ability-engine.js";
import "../../../card-ability-keywords.js";
import "../../../ability-definitions.js";
import "../../../ability-server-reducer.js";
import "./worker-core.js";

type RuntimeGlobals = typeof globalThis & {
  VanguardAbilityEngine: Record<string, unknown>;
  VanguardAbilityServerReducer: Record<string, unknown>;
  VanguardMatchWorkerCore: {
    processRoomAction: (roomCode: string, dependencies: Record<string, unknown>) => Promise<Record<string, unknown>>;
    isRoomSeatAuthUid: (authUid: string, roomSeats: Record<string, unknown> | null) => boolean;
  };
};

const runtime = globalThis as RuntimeGlobals;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store"
};

async function callRpc(name: string, args: Record<string, unknown>, url: string, serviceKey: string) {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify(args)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`RPC ${name} failed (${response.status})`);
  return body ? JSON.parse(body) : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ ok: false, reason: "method-not-allowed" }, { status: 405, headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !anonKey) return Response.json({ ok: false, reason: "worker-not-configured" }, { status: 503, headers: corsHeaders });
  if (!authorization?.startsWith("Bearer ")) return Response.json({ ok: false, reason: "authentication-required" }, { status: 401, headers: corsHeaders });

  let auth: { id?: string };
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
    if (!response.ok) return Response.json({ ok: false, reason: "authentication-required" }, { status: 401, headers: corsHeaders });
    auth = await response.json();
  } catch { return Response.json({ ok: false, reason: "authentication-unavailable" }, { status: 503, headers: corsHeaders }); }

  let roomCode: unknown;
  try { roomCode = (await request.json())?.roomCode; } catch { return Response.json({ ok: false, reason: "invalid-json" }, { status: 400, headers: corsHeaders }); }
  if (typeof roomCode !== "string" || !/^[A-Fa-f0-9]{16}$/.test(roomCode)) {
    return Response.json({ ok: false, reason: "invalid-room-code" }, { status: 400, headers: corsHeaders });
  }

  try {
    const normalizedCode = roomCode.toUpperCase();
    const query = new URLSearchParams({ room_code: `eq.${normalizedCode}`, select: "host_auth_uid,guest_auth_uid" });
    const seatResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/match_rooms?${query}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
    });
    if (!seatResponse.ok) throw new Error("Room seat lookup failed");
    const seatRows = await seatResponse.json();
    const roomSeats = Array.isArray(seatRows) ? seatRows[0] || null : null;
    if (!auth.id || !runtime.VanguardMatchWorkerCore.isRoomSeatAuthUid(auth.id, roomSeats)) {
      return Response.json({ ok: false, reason: "player-not-seated" }, { status: 403, headers: corsHeaders });
    }

    const result = await runtime.VanguardMatchWorkerCore.processRoomAction(normalizedCode, {
      rpc: (name: string, args: Record<string, unknown>) => callRpc(name, args, url, serviceKey),
      engine: runtime.VanguardAbilityEngine,
      reducer: runtime.VanguardAbilityServerReducer
    });
    return Response.json(result, { status: 200, headers: corsHeaders });
  } catch {
    return Response.json({ ok: false, reason: "queued-action-not-committed" }, { status: 409, headers: corsHeaders });
  }
});
