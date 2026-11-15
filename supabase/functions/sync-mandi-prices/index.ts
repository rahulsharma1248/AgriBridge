// AgriBridge mandi-price source diagnostic.
// This temporary version checks the candidate data.gov.in resource only.
// It does NOT write anything to the database.
const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Use POST to run this diagnostic." }, 405);
  }

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN");
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return json({ error: "Unauthorized diagnostic request." }, 401);
  }

  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY");
  if (!apiKey) {
    return json({ error: "DATA_GOV_IN_API_KEY secret is missing." }, 503);
  }

  try {
    const endpoint = new URL("https://api.data.gov.in/resource/" + RESOURCE_ID);
    endpoint.searchParams.set("api-key", apiKey);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("limit", "2");
    endpoint.searchParams.set("offset", "0");

    const upstream = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "AgriBridge/1.0" },
      signal: AbortSignal.timeout(20000),
    });

    const responseText = await upstream.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return json({
        success: false,
        resourceId: RESOURCE_ID,
        upstreamStatus: upstream.status,
        message: "The API response was not valid JSON.",
        responsePreview: responseText.slice(0, 500),
      }, 502);
    }

    const records = Array.isArray(payload.records) ? payload.records : [];
    const firstRecord = records.length > 0 && records[0] && typeof records[0] === "object"
      ? records[0] as Record<string, unknown>
      : null;

    return json({
      success: upstream.ok && records.length > 0,
      resourceId: RESOURCE_ID,
      upstreamStatus: upstream.status,
      payloadKeys: Object.keys(payload),
      total: payload.total ?? payload.count ?? null,
      recordsReturned: records.length,
      recordFieldNames: firstRecord ? Object.keys(firstRecord) : [],
      sampleRecord: firstRecord,
      note: "Diagnostic only: no records were inserted or changed in Supabase.",
    }, upstream.ok ? 200 : 502);
  } catch (error) {
    return json({
      success: false,
      resourceId: RESOURCE_ID,
      error: error instanceof Error ? error.message : "Unknown server error",
    }, 502);
  }
});
