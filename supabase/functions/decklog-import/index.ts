const allowedOrigins = new Set([
  "https://yumekazaki.github.io",
  "http://localhost:8000",
  "http://localhost:5173",
  "http://127.0.0.1:5500"
]);

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin && allowedOrigins.has(origin) ? origin : "null",
    "access-control-allow-headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    "vary": "Origin"
  };
}

function respond(request: Request, body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request.headers.get("origin")) });
}

function sanitizeRows(rows: unknown, maxRows = 1000, defaultSingleCopy = false) {
  if (rows == null) return [];
  if (!Array.isArray(rows) || rows.length > maxRows) throw new Error("invalid-deck-list");
  return rows.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("invalid-deck-list");
    const row = entry as Record<string, unknown>;
    const cardNumber = String(row.card_number ?? row.cardNumber ?? row.number ?? "").trim().slice(0, 48);
    const quantity = Number(row.num ?? row.quantity ?? row.count ?? (defaultSingleCopy ? 1 : NaN));
    if (!/^[A-Za-z0-9./_-]{1,48}$/.test(cardNumber) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) throw new Error("invalid-deck-list");
    return {
      card_number: cardNumber,
      num: quantity,
      slot: String(row.slot ?? "").slice(0, 32),
      name: String(row.name ?? row.card_name ?? row.cardName ?? "").slice(0, 120)
    };
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return respond(request, { error: "origin-not-allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return respond(request, { error: "method-not-allowed" }, 405);
  if (Number(request.headers.get("content-length") || 0) > 1024) return respond(request, { error: "request-too-large" }, 413);

  let code: unknown;
  try { code = (await request.json())?.deckCode; }
  catch { return respond(request, { error: "invalid-request" }, 400); }
  if (typeof code !== "string" || !/^[A-Za-z0-9]{4,10}$/.test(code)) return respond(request, { error: "invalid-decklog-code" }, 400);
  const normalizedCode = code.toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const deckUrl = `https://decklog-en.bushiroad.com/view/${normalizedCode}`;
    const response = await fetch(`https://decklog-en.bushiroad.com/system/app/api/view/${normalizedCode}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "https://decklog-en.bushiroad.com",
        "referer": deckUrl,
        "x-requested-with": "XMLHttpRequest"
      },
      signal: controller.signal
    });
    if (!response.ok) return respond(request, { error: "decklog-unavailable" }, 502);
    const text = await response.text();
    if (text.length > 1_000_000) return respond(request, { error: "decklog-response-too-large" }, 502);
    let source: Record<string, unknown>;
    try { source = JSON.parse(text); }
    catch { return respond(request, { error: "decklog-invalid-response" }, 502); }
    if (Number(source.game_title_id) !== 1 || !["P", "D"].includes(String(source.deck_param1 ?? "").toUpperCase()) || !Array.isArray(source.list)) {
      return respond(request, { error: "decklog-code-not-found" }, 404);
    }
    const subList = sanitizeRows(source.sub_list), presetList = sanitizeRows(source.p_list, 1000, true);
    return respond(request, {
      game_title_id: 1,
      deck_param1: String(source.deck_param1).toUpperCase(),
      deck_name: String(source.deck_name ?? source.deckName ?? source.title ?? source.name ?? "").slice(0, 80),
      list: sanitizeRows(source.list),
      sub_list: subList,
      p_list: presetList
    });
  } catch {
    return respond(request, { error: "decklog-unavailable" }, 502);
  } finally {
    clearTimeout(timeout);
  }
});

