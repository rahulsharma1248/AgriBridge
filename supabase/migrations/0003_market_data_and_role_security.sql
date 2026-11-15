-- AgriBridge migration 0003
-- Harden profile role assignment, enforce seller/buyer actions in the database,
-- and prepare stable source-keyed AGMARKNET price ingestion.
-- Apply once in Supabase SQL Editor after migration 0002.

-- Signup metadata may select one of the supported account types.
-- Role changes after signup are not permitted through the ordinary client session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_type text;
begin
  requested_type := new.raw_user_meta_data ->> 'account_type';
  if requested_type is null or requested_type not in ('buyer', 'seller', 'both') then
    requested_type := 'buyer';
  end if;

  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_type
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_type is distinct from old.account_type
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Account type cannot be changed from profile settings.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update on public.profiles
for each row execute function public.prevent_self_role_change();

-- Database-level role checks: hiding a button in the browser is not authorization.
drop policy if exists "Users can create own listings" on public.produce_listings;
create policy "Sellers can create own listings"
on public.produce_listings for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('seller', 'both')
  )
);

drop policy if exists "Users can update own listings" on public.produce_listings;
create policy "Sellers can update own listings"
on public.produce_listings for update to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('seller', 'both')
  )
)
with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('seller', 'both')
  )
);

drop policy if exists "Users can delete own listings" on public.produce_listings;
create policy "Sellers can delete own listings"
on public.produce_listings for delete to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('seller', 'both')
  )
);

drop policy if exists "Users can create own requirements" on public.buyer_requirements;
create policy "Buyers can create own requirements"
on public.buyer_requirements for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('buyer', 'both')
  )
);

drop policy if exists "Users can update own requirements" on public.buyer_requirements;
create policy "Buyers can update own requirements"
on public.buyer_requirements for update to authenticated
using (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('buyer', 'both')
  )
)
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('buyer', 'both')
  )
);

drop policy if exists "Users can delete own requirements" on public.buyer_requirements;
create policy "Buyers can delete own requirements"
on public.buyer_requirements for delete to authenticated
using (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('buyer', 'both')
  )
);

-- Only buyer-capable accounts can initiate marketplace enquiries.
drop policy if exists "Buyers can create enquiries for published listings" on public.enquiries;
create policy "Buyer accounts can create enquiries for published listings"
on public.enquiries for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('buyer', 'both')
  )
  and exists (
    select 1 from public.produce_listings listing
    where listing.id = enquiries.listing_id
      and listing.seller_id = enquiries.seller_id
      and listing.status = 'published'
  )
);

-- Keep a stable source key so repeated paginated imports update, not duplicate, observations.
alter table public.mandi_prices
  add column if not exists grade text,
  add column if not exists source_record_id text;

update public.mandi_prices
set source_record_id = lower(concat_ws(
  '|',
  state,
  coalesce(district, ''),
  market,
  commodity,
  coalesce(variety, ''),
  coalesce(grade, ''),
  arrival_date::text
))
where source_record_id is null;

alter table public.mandi_prices alter column source_record_id set not null;
create unique index if not exists idx_mandi_prices_source_record_id
on public.mandi_prices(source_record_id);

create index if not exists idx_mandi_prices_location_date
on public.mandi_prices(state, district, market, arrival_date desc);

create index if not exists idx_mandi_prices_commodity_date
on public.mandi_prices(commodity, arrival_date desc);
