// AgriBridge outbound-network diagnostic for data.gov.in.
// This diagnostic does not write to the database or reveal API secrets.
const RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function probe(url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "*/*", "User-Agent": "AgriBridge/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    return { reachable: true, status: response.status, elapsedMs: Date.now() - started };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Connection failed",
      elapsedMs: Date.now() - started,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN")?.trim();
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return json({ error: "Unauthorized diagnostic request." }, 401);
  }

  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY")?.trim();
  if (!apiKey) {
    return json({
      success: false,
      apiKeyConfigured: false,
      error: "DATA_GOV_IN_API_KEY is missing or blank in Supabase Edge Function Secrets.",
    }, 503);
  }

  const generalInternet = await probe("https://www.google.com/generate_204");
  const governmentHost = await probe("https://api.data.gov.in/");

  if (!governmentHost.reachable) {
    return json({
      success: false,
      resourceId: RESOURCE_ID,
      apiKeyConfigured: true,
      connectivity: { generalInternet, governmentHost },
      error: "Supabase could not connect to the data.gov.in host. This is a network connectivity failure, not evidence of an invalid API key.",
      note: "No API key or authenticated request URL is included. No database records were changed.",
    }, 502);
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
        apiKeyConfigured: true,
        connectivity: { generalInternet, governmentHost },
        upstreamStatus: upstream.status,
        error: "The government host was reachable but did not return valid JSON.",
        responsePreview: responseText.slice(0, 300),
      }, 502);
    }

    const records = Array.isArray(payload.records) ? payload.records : [];
    const firstRecord = records.length && records[0] && typeof records[0] === "object"
      ? records[0] as Record<string, unknown>
      : null;

    return json({
      success: upstream.ok && records.length > 0,
      resourceId: RESOURCE_ID,
      apiKeyConfigured: true,
      connectivity: { generalInternet, governmentHost },
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
      apiKeyConfigured: true,
      connectivity: { generalInternet, governmentHost },
      error: "The government API request failed after the host connectivity probe.",
      detail: error instanceof Error ? error.message : "Unknown request failure",
      note: "No API key or authenticated request URL is included.",
    }, 502);
  }
});
