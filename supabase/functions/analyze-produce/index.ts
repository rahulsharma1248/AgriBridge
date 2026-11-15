// Deploy as Supabase Edge Function: analyze-produce
// Required secret: OPENAI_API_KEY
// Uses Supabase's injected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// This function is advisory visual assistance, not certified grading.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reply({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) return reply({ error: "AI analysis is not configured yet." }, 503);

  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply({ error: "Invalid session" }, 401);

  let body: { imagePath?: string; listingId?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON body" }, 400); }
  const imagePath = body.imagePath?.trim();
  if (!imagePath || !imagePath.startsWith(auth.user.id + "/")) {
    return reply({ error: "Use an image uploaded to your own account folder." }, 400);
  }

  const admin = createClient(url, serviceKey);
  const { data: signed, error: signedError } = await admin.storage
    .from("produce-images").createSignedUrl(imagePath, 120);
  if (signedError || !signed?.signedUrl) return reply({ error: "Could not access the uploaded image." }, 400);

  let listingId: string | null = null;
  if (body.listingId) {
    const { data: listing } = await userClient.from("produce_listings")
      .select("id").eq("id", body.listingId).eq("seller_id", auth.user.id).maybeSingle();
    if (!listing) return reply({ error: "Listing not found or not owned by you." }, 403);
    listingId = listing.id;
  }

  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + openAiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Inspect this agricultural produce photo. Return concise JSON with: visible_product, visible_appearance, visible_defects (array), image_limitations (array), suggested_questions_for_seller (array). Only describe what is visibly supported. Do not infer pesticide residues, food safety, internal quality, exact grade, origin, or certification. State uncertainty clearly. This is advisory visual assistance, not certified grading." },
          { type: "input_image", image_url: signed.signedUrl, detail: "high" }
        ]
      }],
      text: { format: { type: "json_object" } }
    })
  });
  if (!aiResponse.ok) {
    const detail = await aiResponse.text();
    return reply({ error: "AI provider request failed.", detail: detail.slice(0, 400) }, 502);
  }
  const result = await aiResponse.json();
  const outputText = result.output?.flatMap((item: any) => item.content ?? [])
    .find((item: any) => item.type === "output_text")?.text;
  if (!outputText) return reply({ error: "AI provider returned no analysis." }, 502);
  let analysis: unknown;
  try { analysis = JSON.parse(outputText); } catch { return reply({ error: "AI response was not valid structured output." }, 502); }

  const { data: saved, error: saveError } = await admin.from("produce_ai_analyses").insert({
    listing_id: listingId, user_id: auth.user.id, image_path: imagePath,
    model_name: "gpt-4.1-mini", analysis,
    disclaimer: "AI-generated visual observations only; not certified grading, a food-safety assessment, or a guarantee."
  }).select("id,analysis,disclaimer,created_at").single();
  if (saveError) return reply({ error: "Analysis completed but could not be saved." }, 500);
  return reply(saved);
});
