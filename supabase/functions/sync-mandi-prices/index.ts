// AgriBridge mandi-price source diagnostic.
// Checks the candidate data.gov.in resource only; does not write to Supabase.
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

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN")?.trim();
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return json({ error: "Unauthorized diagnostic request." }, 401);
  }

  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY")?.trim();
  if (!apiKey) {
    return json({
      success: false,
      resourceId: RESOURCE_ID,
      error: "DATA_GOV_IN_API_KEY is missing or blank in Supabase Edge Function Secrets.",
      hint: "Open Edge Functions > Secrets, update DATA_GOV_IN_API_KEY with the current data.gov.in key, and save. No redeploy is required for a secret update.",
    }, 503);
  }

  try {
    const endpoint = new URL("https://api.data.gov.in/resource/" + RESOURCE_ID);
    endpoint.searchParams.set("api-key", apiKey);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("limit", "2");
    endpoint.searchParams.set("offset", "0");

    let upstream: Response;
    try {
      upstream = await fetch(endpoint, {
        headers: { Accept: "application/json", "User-Agent": "AgriBridge/1.0" },
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      return json({
        success: false,
        resourceId: RESOURCE_ID,
        apiKeyConfigured: true,
        error: "Supabase could not establish a network connection to data.gov.in.",
        detail: error instanceof Error ? error.message : "Network connection failed.",
        note: "The API key is not included in this diagnostic response.",
      }, 502);
    }

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
        responsePreview: responseText.slice(0, 300),
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
  } catch {
    return json({
      success: false,
      resourceId: RESOURCE_ID,
      error: "The diagnostic failed before receiving a valid API response.",
      note: "No API key or request URL is included in this response.",
    }, 500);
  }
});
