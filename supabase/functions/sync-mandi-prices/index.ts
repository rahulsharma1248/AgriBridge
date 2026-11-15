// AgriBridge daily mandi-price ingestion.
// Required Edge Function secrets:
//   DATA_GOV_IN_API_KEY
//   MARKET_PRICE_SYNC_TOKEN
// Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Invoke only from a trusted scheduler with x-sync-token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const PAGE_SIZE = 100;
const MAX_PAGES = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  const normalized = clean(value).replace(/,/g, "");
  if (!normalized || normalized.toLowerCase() === "na" || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown): string {
  const raw = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  return match[3] + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
}

function mapRecord(record: Record<string, unknown>) {
  const state = clean(record.state);
  const district = clean(record.district);
  const market = clean(record.market);
  const commodity = clean(record.commodity);
  const variety = clean(record.variety);
  const grade = clean(record.grade);
  const arrivalDate = normalizeDate(record.arrival_date ?? record.date);

  if (!state || !market || !commodity || !arrivalDate) return null;

  // Stable key allows safe re-runs even when optional fields are blank.
  const sourceRecordId = [
    state, district, market, commodity, variety, grade, arrivalDate,
  ].map(value => value.toLocaleLowerCase("en-IN")).join("|");

  return {
    source_record_id: sourceRecordId,
    state,
    district: district || null,
    market,
    commodity,
    variety: variety || null,
    grade: grade || null,
    arrival_date: arrivalDate,
    min_price: numberOrNull(record.min_price),
    max_price: numberOrNull(record.max_price),
    modal_price: numberOrNull(record.modal_price),
    source_name: "AGMARKNET via data.gov.in",
    source_url: "https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi",
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN");
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return json({ error: "Unauthorized sync request" }, 401);
  }

  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server-side data source or Supabase configuration is incomplete." }, 503);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    let offset = 0;
    let received = 0;
    let saved = 0;
    let pages = 0;
    let latestArrivalDate: string | null = null;
    let reachedPageLimit = false;

    while (pages < MAX_PAGES) {
      const endpoint = new URL("https://api.data.gov.in/resource/" + RESOURCE_ID);
      endpoint.searchParams.set("api-key", apiKey);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("limit", String(PAGE_SIZE));
      endpoint.searchParams.set("offset", String(offset));

      const upstream = await fetch(endpoint, {
        headers: { Accept: "application/json", "User-Agent": "AgriBridge/1.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) {
        return json({
          error: "The government data source returned HTTP " + upstream.status + ".",
          pagesCompleted: pages,
          recordsSaved: saved,
        }, 502);
      }

      const payload = await upstream.json();
      const records = Array.isArray(payload.records) ? payload.records : [];
      if (records.length === 0) break;

      received += records.length;
      pages += 1;
      const rows = records
        .map((record: Record<string, unknown>) => mapRecord(record))
        .filter((row): row is NonNullable<ReturnType<typeof mapRecord>> => row !== null);

      for (let index = 0; index < rows.length; index += 200) {
        const batch = rows.slice(index, index + 200);
        const { error } = await admin.from("mandi_prices").upsert(batch, {
          onConflict: "source_record_id",
        });
        if (error) {
          return json({
            error: "Could not save mandi-price records.",
            detail: error.message,
            pagesCompleted: pages,
            recordsSaved: saved,
          }, 500);
        }
        saved += batch.length;
        for (const row of batch) {
          if (!latestArrivalDate || row.arrival_date > latestArrivalDate) {
            latestArrivalDate = row.arrival_date;
          }
        }
      }

      offset += records.length;
      const total = Number(payload.total ?? payload.count ?? 0);
      if (total > 0 && offset >= total) break;
      if (records.length < PAGE_SIZE) break;
      if (pages === MAX_PAGES) reachedPageLimit = true;
    }

    if (pages === 0 || saved === 0) {
      return json({
        error: "The source returned no usable mandi-price records. Check the API key and dataset availability.",
        pagesCompleted: pages,
        recordsReceived: received,
      }, 502);
    }

    return json({
      success: true,
      source: "AGMARKNET via data.gov.in",
      resourceId: RESOURCE_ID,
      pagesFetched: pages,
      recordsReceived: received,
      recordsSaved: saved,
      latestArrivalDate,
      reachedPageLimit,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({
      error: "Mandi-price synchronization failed.",
      detail: error instanceof Error ? error.message : "Unknown server error",
    }, 500);
  }
});
