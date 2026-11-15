// AgriBridge alternative mandi-source connectivity diagnostic.
// No database writes. No API keys are sent to the alternative public endpoints.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function probe(name: string, url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; AgriBridge/1.0)",
        ...headers,
      },
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.text();
    let preview: unknown = body.slice(0, 600);
    try { preview = JSON.parse(body); } catch { /* keep short text preview */ }
    return {
      name,
      reachable: true,
      status: response.status,
      elapsedMs: Date.now() - started,
      responsePreview: preview,
    };
  } catch (error) {
    return {
      name,
      reachable: false,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const expectedToken = Deno.env.get("MARKET_PRICE_SYNC_TOKEN")?.trim();
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return json({ error: "Unauthorized diagnostic request." }, 401);
  }

  const checks = await Promise.all([
    probe("General internet", "https://www.google.com/generate_204"),
    probe(
      "Official AGMARKNET API",
      "https://api.agmarknet.gov.in/v1/daily-price-arrival/filters",
      {
        Origin: "https://agmarknet.gov.in",
        Referer: "https://agmarknet.gov.in/",
      },
    ),
    probe("Third-party mandi API", "https://api.dharun.dev/v1/mandi?limit=2"),
  ]);

  return json({
    success: checks.some((check) => check.reachable && check.status >= 200 && check.status < 300),
    checks,
    note: "Connectivity diagnostic only. No API keys were sent and no Supabase database records were changed.",
  });
});
