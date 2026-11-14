-- AgriBridge migration 0002: preserve selected account type during email confirmation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_type text;
begin
  selected_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'buyer');
  if selected_type not in ('buyer', 'seller', 'both') then
    selected_type := 'buyer';
  end if;

  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    selected_type
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
