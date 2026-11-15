// AgriBridge daily mandi-price importer.
// Source: AGMARKNET data.gov.in, accessed through the tested India API mirror.
// The mirror retains the latest 30 days and supports state/date filters.
// This function imports the latest available day for each Indian state/UT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE_API = "https://api.dharun.dev/v1/mandi";
const SOURCE_URL = "https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi";
const SOURCE_NAME = "AGMARKNET via India API";
const PAGE_LIMIT = 1000;

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sync-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRecord(record: Record<string, unknown>, fetchedAt: string) {
  const state = clean(record.state);
  const district = clean(record.district);
  const market = clean(record.market);
  const commodity = clean(record.commodity);
  const arrivalDate = clean(record.date);
  if (!state || !market || !commodity || !arrivalDate || !/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
    return null;
  }

  const variety = clean(record.variety);
  const grade = clean(record.grade);
  // Match the database's existing unique key. The source may return multiple
  // grades for the same market/commodity/variety/date; the current table
  // permits only one row for that combination.
  const sourceRecordId = [
    state, district ?? "", market, commodity, variety ?? "", arrivalDate,
  ].join("|").toLowerCase();

  return {
    source_record_id: sourceRecordId,
    state,
    district,
    market,
    commodity,
    variety,
    grade,
    arrival_date: arrivalDate,
    min_price: numeric(record.min_price),
    max_price: numeric(record.max_price),
    modal_price: numeric(record.modal_price),
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    fetched_at: fetchedAt,
  };
}

async function fetchState(state: string) {
  const url = new URL(SOURCE_API);
  url.searchParams.set("state", state);
  url.searchParams.set("limit", String(PAGE_LIMIT));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "AgriBridge/1.0 (daily mandi price importer)",
    },
    signal: AbortSignal.timeout(20000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 250));
  }
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("The mandi API returned an unexpected response format.");
  }
  return payload.data as Record<string, unknown>[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN")?.trim();
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return reply({ error: "Unauthorized. Check the x-sync-token header." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ error: "Supabase server credentials are not configured." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fetchedAt = new Date().toISOString();
  const allRows = new Map<string, ReturnType<typeof mapRecord>>();
  const stateErrors: { state: string; error: string }[] = [];
  const stateCounts: Record<string, number> = {};

  // Stay comfortably below the public API's per-address request limit.
  for (const state of STATES) {
    try {
      const records = await fetchState(state);
      let accepted = 0;
      for (const record of records) {
        const mapped = mapRecord(record, fetchedAt);
        if (mapped) {
          // Keep one row per existing database unique key. Different grades
          // for the same observation cannot coexist under the current schema.
          allRows.set(mapped.source_record_id, mapped);
          accepted++;
        }
      }
      stateCounts[state] = accepted;
    } catch (error) {
      stateErrors.push({
        state,
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const rows = Array.from(allRows.values()).filter(
    (row): row is NonNullable<typeof row> => row !== null,
  );

  if (rows.length === 0) {
    return reply({
      success: false,
      imported: 0,
      message: "No valid mandi rows were received. The existing database records were left unchanged.",
      stateErrors,
    }, 502);
  }

  let upserted = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const { error } = await admin
      .from("mandi_prices")
      .upsert(batch, { onConflict: "source_record_id" });
    if (error) {
      return reply({
        success: false,
        importedBeforeError: upserted,
        error: error.message,
        message: "The import stopped after a database error. Existing rows were not deleted.",
      }, 500);
    }
    upserted += batch.length;
  }

  const dates = [...new Set(rows.map((row) => row.arrival_date))].sort();
  const cappedStates = Object.entries(stateCounts)
    .filter(([, count]) => count >= PAGE_LIMIT)
    .map(([state]) => state);

  return reply({
    success: stateErrors.length === 0,
    imported: upserted,
    statesFetched: Object.keys(stateCounts).length,
    statesFailed: stateErrors.length,
    reportDates: dates,
    stateCounts,
    cappedStates,
    stateErrors,
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    note: "The API allows at most 1,000 rows per state request and retains the latest 30 days. States listed under cappedStates may have additional observations not included in this run. No existing rows were deleted.",
  });
});
