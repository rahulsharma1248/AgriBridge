# AgriBridge extended integrations — deployment checklist

This document describes what is committed and what still requires dashboard setup. Do not put provider secrets in GitHub or Vite environment variables.

## 1. Apply the second database migration

In Supabase Dashboard, open SQL Editor → New query. Copy the complete contents of `supabase/migrations/0002_extended_marketplace.sql` from GitHub and run it. It creates:
- `listing_images` and the `produce-images` Storage bucket
- `transport_profiles`, `transport_requests`, and `transport_quotes`
- `produce_ai_analyses`
- `mandi_prices`
- `payment_orders`

Confirm the new tables exist and RLS is enabled. The migration is intended to run after `0001_initial_schema.sql`.

## 2. Deploy Supabase Edge Functions

The following source files are committed:
- `supabase/functions/analyze-produce/index.ts`
- `supabase/functions/sync-mandi-prices/index.ts`

Deploy each as a Supabase Edge Function with the matching function name. Keep JWT verification enabled for `analyze-produce`. The market sync function additionally checks the `x-sync-token` header.

### AI photo analysis secrets

Set `OPENAI_API_KEY` in Supabase → Edge Functions → Secrets. The function uses the OpenAI API model `gpt-4.1-mini`. A ChatGPT subscription does not include API credits; an OpenAI API account and billing may be required. The feature is advisory visual assistance, not certified grading or a food-safety test.

### Mandi price sync secrets

Set these Edge Function secrets:
- `DATA_GOV_IN_API_KEY`: API key from data.gov.in
- `AGMARKNET_RESOURCE_ID`: resource identifier for the official daily mandi-price dataset
- `MARKET_PRICE_SYNC_TOKEN`: a long random token used only by a trusted scheduler

The sync function writes source-attributed daily prices to `mandi_prices`. The public data.gov.in dataset is daily, not tick-by-tick real-time. The UI must show the report date and source, and stale prices must not be described as live.

## 3. Transport workflows

The authenticated app includes a transport workspace for provider profiles, service areas, vehicle types, cargo requests, and provider quotes. Provider verification is manual; the UI must not imply that an unverified profile is vetted. A provider cannot self-mark as verified under the migration's insert/update policies.

## 4. Payments — intentionally not enabled for live collection

The schema includes a private payment-order ledger, but no browser-side payment action is enabled. Before implementing live checkout, the business owner must:
1. Create and verify a Razorpay merchant account and complete its required business/KYC onboarding.
2. Decide whether AgriBridge is only collecting for its own sale or facilitating payments between independent buyers and sellers.
3. For marketplace split settlements, confirm eligibility and onboarding for Razorpay Route or another approved marketplace payout product.
4. Define who is merchant of record, fees, refunds, cancellations, disputes, tax invoices, and seller settlement terms.

Only after those decisions should server-side order creation, signature verification, and webhooks be activated. Never put a Razorpay Key Secret or webhook secret in frontend code. Do not describe the payment ledger as escrow.

## 5. Cloudflare Pages environment variables

Keep only the Supabase Project URL and publishable key in the frontend build environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never add the Supabase service-role key, OpenAI API key, data.gov.in API key, Razorpay Key Secret, or sync token to Vite variables or GitHub.
