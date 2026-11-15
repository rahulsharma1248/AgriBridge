-- AgriBridge: extended marketplace capabilities
-- Apply after 0001_initial_schema.sql.
-- Includes public produce photos, transport coordination, advisory AI records,
-- source-attributed mandi prices, and payment records.

-- Public listing images: files are public to view, but only the listing owner may upload/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produce-images', 'produce-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_listing_images_listing on public.listing_images(listing_id);
alter table public.listing_images enable row level security;

drop policy if exists "Listing images visible with listing" on public.listing_images;
create policy "Listing images visible with listing"
on public.listing_images for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.produce_listings l
    where l.id = listing_images.listing_id and l.status = 'published'
  )
);

drop policy if exists "Owners can add listing images" on public.listing_images;
create policy "Owners can add listing images"
on public.listing_images for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.produce_listings l
    where l.id = listing_images.listing_id and l.seller_id = (select auth.uid())
  )
);

drop policy if exists "Owners can remove listing images" on public.listing_images;
create policy "Owners can remove listing images"
on public.listing_images for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Seller uploads produce photos to own folder" on storage.objects;
create policy "Seller uploads produce photos to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'produce-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Seller deletes own produce photos" on storage.objects;
create policy "Seller deletes own produce photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'produce-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Transport partners are separate from buyer/seller account types.
create table if not exists public.transport_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  contact_phone text not null,
  vehicle_types text[] not null default '{}',
  service_areas text[] not null default '{}',
  description text,
  is_available boolean not null default true,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid references public.transport_profiles(id) on delete set null,
  listing_id uuid references public.produce_listings(id) on delete set null,
  pickup_location text not null,
  delivery_location text not null,
  cargo_description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null,
  pickup_date date,
  status text not null default 'open'
    check (status in ('open','quoted','accepted','in_transit','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_transport_requests_status on public.transport_requests(status);
create index if not exists idx_transport_requests_requester on public.transport_requests(requester_id);

create table if not exists public.transport_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  provider_id uuid not null references public.transport_profiles(id) on delete cascade,
  quoted_amount numeric(12,2) not null check (quoted_amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  message text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique(request_id, provider_id)
);
create index if not exists idx_transport_quotes_request on public.transport_quotes(request_id);

alter table public.transport_profiles enable row level security;
alter table public.transport_requests enable row level security;
alter table public.transport_quotes enable row level security;

drop policy if exists "Transport profiles are visible to authenticated users" on public.transport_profiles;
create policy "Transport profiles are visible to authenticated users"
on public.transport_profiles for select to authenticated using (true);
drop policy if exists "Users manage their own transport profile" on public.transport_profiles;
create policy "Users manage their own transport profile"
on public.transport_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Requesters and available providers can view transport requests" on public.transport_requests;
create policy "Requesters and available providers can view transport requests"
on public.transport_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or (status = 'open' and exists (
    select 1 from public.transport_profiles tp
    where tp.user_id = (select auth.uid()) and tp.is_available = true
  ))
  or exists (
    select 1 from public.transport_profiles tp
    where tp.id = transport_requests.provider_id and tp.user_id = (select auth.uid())
  )
);
drop policy if exists "Buyers can create transport requests" on public.transport_requests;
create policy "Buyers can create transport requests"
on public.transport_requests for insert to authenticated
with check (requester_id = (select auth.uid()));
drop policy if exists "Requesters can update own transport requests" on public.transport_requests;
create policy "Requesters can update own transport requests"
on public.transport_requests for update to authenticated
using (requester_id = (select auth.uid()))
with check (requester_id = (select auth.uid()));

drop policy if exists "Transport quote participants can view quotes" on public.transport_quotes;
create policy "Transport quote participants can view quotes"
on public.transport_quotes for select to authenticated
using (
  exists (select 1 from public.transport_requests tr
    where tr.id = transport_quotes.request_id and tr.requester_id = (select auth.uid()))
  or exists (select 1 from public.transport_profiles tp
    where tp.id = transport_quotes.provider_id and tp.user_id = (select auth.uid()))
);
drop policy if exists "Available providers can quote open requests" on public.transport_quotes;
create policy "Available providers can quote open requests"
on public.transport_quotes for insert to authenticated
with check (
  exists (select 1 from public.transport_profiles tp
    where tp.id = transport_quotes.provider_id
      and tp.user_id = (select auth.uid()) and tp.is_available = true)
  and exists (select 1 from public.transport_requests tr
    where tr.id = transport_quotes.request_id and tr.status = 'open')
);

-- AI analysis is advisory only. Edge Functions create records with service credentials.
create table if not exists public.produce_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.produce_listings(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  model_name text not null,
  analysis jsonb not null,
  disclaimer text not null default 'AI-generated visual observations only; not certified grading or a food-safety assessment.',
  created_at timestamptz not null default now()
);
create index if not exists idx_produce_ai_analyses_user on public.produce_ai_analyses(user_id);
alter table public.produce_ai_analyses enable row level security;
drop policy if exists "Users can view their own AI analyses" on public.produce_ai_analyses;
create policy "Users can view their own AI analyses"
on public.produce_ai_analyses for select to authenticated
using (user_id = (select auth.uid()));

-- Mandi prices are ingested by a scheduled/server process, never written by browsers.
create table if not exists public.mandi_prices (
  id bigint generated by default as identity primary key,
  source_record_id text,
  state text not null,
  district text,
  market text not null,
  commodity text not null,
  variety text,
  arrival_date date not null,
  min_price numeric(12,2),
  max_price numeric(12,2),
  modal_price numeric(12,2),
  source_name text not null default 'AGMARKNET via data.gov.in',
  source_url text not null default 'https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi',
  fetched_at timestamptz not null default now(),
  unique(state,district,market,commodity,variety,arrival_date)
);
create index if not exists idx_mandi_prices_search on public.mandi_prices(commodity,state,arrival_date desc);
alter table public.mandi_prices enable row level security;
drop policy if exists "Mandi prices are readable by everyone" on public.mandi_prices;
create policy "Mandi prices are readable by everyone"
on public.mandi_prices for select to anon, authenticated using (true);

-- Payment rows are written only by trusted server-side functions/webhooks.
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid references public.produce_listings(id) on delete set null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  status text not null default 'created'
    check (status in ('created','authorized','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_parties_differ check (buyer_id <> seller_id)
);
create index if not exists idx_payment_orders_buyer on public.payment_orders(buyer_id);
create index if not exists idx_payment_orders_seller on public.payment_orders(seller_id);
alter table public.payment_orders enable row level security;
drop policy if exists "Payment participants can view their own orders" on public.payment_orders;
create policy "Payment participants can view their own orders"
on public.payment_orders for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- No browser INSERT/UPDATE/DELETE policies are granted for payment_orders or mandi_prices.
