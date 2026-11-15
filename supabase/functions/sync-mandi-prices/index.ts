// Deploy as Supabase Edge Function: sync-mandi-prices
// Set secrets: DATA_GOV_IN_API_KEY, AGMARKNET_RESOURCE_ID, MARKET_PRICE_SYNC_TOKEN.
// Invoke from a trusted scheduler with header x-sync-token. Never expose this token in the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("MARKET_PRICE_SYNC_TOKEN");
  if (!expected || req.headers.get("x-sync-token") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY");
  const resourceId = Deno.env.get("AGMARKNET_RESOURCE_ID");
  if (!apiKey || !resourceId) return Response.json({ error: "Open-data API configuration is incomplete." }, { status: 503 });

  const endpoint = new URL("https://api.data.gov.in/resource/" + encodeURIComponent(resourceId));
  endpoint.searchParams.set("api-key", apiKey);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("limit", "1000");
  endpoint.searchParams.set("offset", "0");

  const upstream = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!upstream.ok) return Response.json({ error: "Government data source returned " + upstream.status }, { status: 502 });
  const payload = await upstream.json();
  const records = Array.isArray(payload.records) ? payload.records : [];
  const normalizeDate = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})$/);
    if (!match) return "";
    return match[3] + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
  };
  const rows = records.map((r: Record<string, unknown>) => ({
    source_record_id: String(r.id ?? [r.state, r.district, r.market, r.commodity, r.variety, r.arrival_date].join("|")),
    state: String(r.state ?? ""),
    district: r.district ? String(r.district) : "",
    market: String(r.market ?? ""),
    commodity: String(r.commodity ?? ""),
    variety: r.variety ? String(r.variety) : "",
    arrival_date: normalizeDate(r.arrival_date ?? r.date),
    min_price: Number(r.min_price ?? r.min_price_rs ?? 0) || null,
    max_price: Number(r.max_price ?? r.max_price_rs ?? 0) || null,
    modal_price: Number(r.modal_price ?? r.modal_price_rs ?? 0) || null,
    source_name: "AGMARKNET via data.gov.in",
    fetched_at: new Date().toISOString()
  })).filter((r: any) => r.state && r.market && r.commodity && /^\d{4}-\d{2}-\d{2}$/.test(r.arrival_date));

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let saved = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await admin.from("mandi_prices").upsert(batch, {
      onConflict: "state,district,market,commodity,variety,arrival_date"
    });
    if (error) return Response.json({ error: "Could not save market data.", detail: error.message }, { status: 500 });
    saved += batch.length;
  }
  return Response.json({ source: "AGMARKNET via data.gov.in", received: records.length, saved, fetchedAt: new Date().toISOString() });
});
