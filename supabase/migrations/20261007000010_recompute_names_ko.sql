-- Operator helper: re-derive cards.name_ko for all cards (service role only).
create or replace function public.recompute_card_names_ko() returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.cards set name_ko = public.ko_card_name(name, national_dex_numbers, supertype)
   where name_ko is distinct from public.ko_card_name(name, national_dex_numbers, supertype);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.recompute_card_names_ko() from public, anon, authenticated;
grant execute on function public.recompute_card_names_ko() to service_role;
