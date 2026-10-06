-- Creates the profile on sign-up and enforces (self-declared) age + terms consent server-side.
-- Under-14 policy: only `age_verified_at` is stored, never a birth date. Declaration method is
-- self-attestation for now (DEC open: stronger verification before release if required).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'age_confirmed', '') <> 'true' then
    raise exception 'AGE_NOT_CONFIRMED' using errcode = 'P0001';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'terms_agreed', '') <> 'true' then
    raise exception 'TERMS_NOT_AGREED' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, terms_agreed_at, terms_version, age_verified_at)
  values (new.id, now(), coalesce(new.raw_user_meta_data ->> 'terms_version', 'v0'), now());
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
