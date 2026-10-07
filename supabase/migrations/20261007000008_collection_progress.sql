-- "My collection" summary: totals + per-set progress for sets where the user owns at least one card.
-- security invoker: RLS on user_cards already restricts rows to the caller.
create or replace function public.get_collection_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED: login required' using errcode = 'PT401';
  end if;

  with owned as (
    select c.set_id, count(*)::int as n
    from public.user_cards uc
    join public.cards c on c.id = uc.card_id
    where uc.user_id = uid
    group by c.set_id
  ),
  totals as (
    select set_id, count(*)::int as n
    from public.cards
    where is_active
    group by set_id
  )
  select jsonb_build_object(
    'totalOwned', coalesce((select sum(n) from owned), 0)::int,
    'totalCards', (select count(*) from public.cards where is_active)::int,
    'sets', coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'series', s.series,
        'releaseDate', s.release_date, 'logo', s.logo_url, 'symbol', s.symbol_url,
        'owned', o.n, 'total', coalesce(t.n, 0)
      ) order by s.release_date desc nulls last, s.id), '[]'::jsonb)
  )
  into result
  from owned o
  join public.card_sets s on s.id = o.set_id
  left join totals t on t.set_id = o.set_id;

  return result;
end;
$$;

revoke execute on function public.get_collection_summary() from public;
grant execute on function public.get_collection_summary() to authenticated;
