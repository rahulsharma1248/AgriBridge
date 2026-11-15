// Deploy as Supabase Edge Function: analyze-produce
// Required secret: GEMINI_API_KEY
// Uses Supabase's injected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Advisory visual assistance only; not certified grading or food-safety assessment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reply({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return reply({ error: "Gemini AI is not configured yet." }, 503);

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

  const imageResponse = await fetch(signed.signedUrl);
  if (!imageResponse.ok) return reply({ error: "Could not download the uploaded image for analysis." }, 400);
  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
  if (imageBytes.length > 5 * 1024 * 1024) return reply({ error: "Image is larger than the 5 MB analysis limit." }, 413);
  const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return reply({ error: "Only JPEG, PNG, and WebP images are supported." }, 415);
  }

  const prompt = "Inspect this agricultural produce photo. Return concise JSON with these keys: visible_product (string), visible_appearance (string), visible_defects (array of strings), image_limitations (array of strings), suggested_questions_for_seller (array of strings). Only describe what is visibly supported. Do not infer pesticide residues, food safety, internal quality, exact grade, origin, or certification. State uncertainty clearly. This is advisory visual assistance, not certified grading.";
  const aiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + encodeURIComponent(geminiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: toBase64(imageBytes) } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }),
    },
  );
  if (!aiResponse.ok) {
    const detail = await aiResponse.text();
    return reply({ error: "Gemini request failed. Check API key, model access, or free-tier quota.", detail: detail.slice(0, 500) }, 502);
  }
  const result = await aiResponse.json();
  const outputText = result.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "").join("").trim();
  if (!outputText) return reply({ error: "Gemini returned no analysis. The image may need to be clearer." }, 502);

  let analysis: unknown;
  try { analysis = JSON.parse(outputText); }
  catch { return reply({ error: "Gemini response was not valid structured JSON." }, 502); }

  const { data: saved, error: saveError } = await admin.from("produce_ai_analyses").insert({
    listing_id: listingId, user_id: auth.user.id, image_path: imagePath,
    model_name: "gemini-2.5-flash-lite", analysis,
    disclaimer: "AI-generated visual observations only; not certified grading, a food-safety assessment, or a guarantee.",
  }).select("id,analysis,disclaimer,created_at").single();
  if (saveError) return reply({ error: "Analysis completed but could not be saved." }, 500);
  return reply(saved);
});
