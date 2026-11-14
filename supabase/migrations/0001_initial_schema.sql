-- AgriBridge initial database schema
-- Migration: 0001_initial_schema
-- Creates profiles, produce listings, buyer requirements, and enquiries.
-- Enables Row Level Security and applies initial ownership policies.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  account_type text not null default 'buyer'
    check (account_type in ('buyer', 'seller', 'both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.produce_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  produce_name text not null,
  category text,
  description text,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null,
  asking_price numeric(12,2) check (asking_price is null or asking_price >= 0),
  location text not null,
  available_from date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_requirements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  produce_name text not null,
  category text,
  description text,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null,
  delivery_location text not null,
  needed_by date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 3000),
  status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed')),
  created_at timestamptz not null default now(),
  constraint different_buyer_and_seller check (buyer_id <> seller_id)
);

create index if not exists idx_listings_seller on public.produce_listings(seller_id);
create index if not exists idx_listings_status on public.produce_listings(status);
create index if not exists idx_requirements_buyer on public.buyer_requirements(buyer_id);
create index if not exists idx_requirements_status on public.buyer_requirements(status);
create index if not exists idx_enquiries_buyer on public.enquiries(buyer_id);
create index if not exists idx_enquiries_seller on public.enquiries(seller_id);

alter table public.profiles enable row level security;
alter table public.produce_listings enable row level security;
alter table public.buyer_requirements enable row level security;
alter table public.enquiries enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Users can view published listings or own listings" on public.produce_listings;
create policy "Users can view published listings or own listings" on public.produce_listings for select to authenticated
using (status = 'published' or seller_id = (select auth.uid()));

drop policy if exists "Users can create own listings" on public.produce_listings;
create policy "Users can create own listings" on public.produce_listings for insert to authenticated
with check (seller_id = (select auth.uid()));

drop policy if exists "Users can update own listings" on public.produce_listings;
create policy "Users can update own listings" on public.produce_listings for update to authenticated
using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));

drop policy if exists "Users can delete own listings" on public.produce_listings;
create policy "Users can delete own listings" on public.produce_listings for delete to authenticated
using (seller_id = (select auth.uid()));

drop policy if exists "Users can view published requirements or own requirements" on public.buyer_requirements;
create policy "Users can view published requirements or own requirements" on public.buyer_requirements for select to authenticated
using (status = 'published' or buyer_id = (select auth.uid()));

drop policy if exists "Users can create own requirements" on public.buyer_requirements;
create policy "Users can create own requirements" on public.buyer_requirements for insert to authenticated
with check (buyer_id = (select auth.uid()));

drop policy if exists "Users can update own requirements" on public.buyer_requirements;
create policy "Users can update own requirements" on public.buyer_requirements for update to authenticated
using (buyer_id = (select auth.uid())) with check (buyer_id = (select auth.uid()));

drop policy if exists "Users can delete own requirements" on public.buyer_requirements;
create policy "Users can delete own requirements" on public.buyer_requirements for delete to authenticated
using (buyer_id = (select auth.uid()));

drop policy if exists "Enquiry participants can view enquiries" on public.enquiries;
create policy "Enquiry participants can view enquiries" on public.enquiries for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

drop policy if exists "Buyers can create enquiries for published listings" on public.enquiries;
create policy "Buyers can create enquiries for published listings" on public.enquiries for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.produce_listings listing
    where listing.id = enquiries.listing_id
      and listing.seller_id = enquiries.seller_id
      and listing.status = 'published'
  )
);
