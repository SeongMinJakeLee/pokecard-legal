-- 002: read RPCs (docs/04 §9.4, docs/05 §3, §4.5)
-- Error codes use PostgREST custom SQLSTATEs (PT400/PT401/PT404/PT422 -> HTTP status).
-- All functions are SECURITY INVOKER; RLS applies. Sort keys come from a fixed allow-list,
-- user values are only ever passed as bound parameters (never concatenated).

create or replace function public.list_cards(
  q           text    default null,
  set_ids     text[]  default null,
  types       text[]  default null,
  rarities    text[]  default null,
  owned       text    default 'all',
  sort        text    default 'releaseDate',
  ord         text    default null,
  lim         int     default 30,
  page_cursor text    default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_q     text := nullif(btrim(coalesce(q, '')), '');
  v_pat   text;
  v_dir   text;
  v_key   text;
  v_ktype text;
  v_cmp   text;
  v_cur   jsonb;
  v_cursor_clause text := '';
  v_sql   text;
  v_rows  jsonb;
  v_has_next boolean;
  v_last  jsonb;
  v_next  text := null;
  v_items jsonb;
begin
  if lim is null or lim < 1 or lim > 100 then
    raise exception 'VALIDATION_FAILED: lim must be between 1 and 100' using errcode = 'PT422';
  end if;
  if owned is null or owned not in ('all', 'owned', 'unowned') then
    raise exception 'VALIDATION_FAILED: owned must be all, owned or unowned' using errcode = 'PT422';
  end if;
  if owned <> 'all' and v_uid is null then
    raise exception 'UNAUTHENTICATED: login required for owned filter' using errcode = 'PT401';
  end if;
  if v_q is not null and char_length(v_q) > 50 then
    raise exception 'VALIDATION_FAILED: q is too long (max 50)' using errcode = 'PT422';
  end if;
  if sort is null or sort not in ('name', 'releaseDate', 'number', 'hp', 'rarity') then
    raise exception 'BAD_REQUEST: invalid sort' using errcode = 'PT400';
  end if;

  v_dir := coalesce(ord, case sort
    when 'name' then 'asc' when 'releaseDate' then 'desc' when 'number' then 'asc'
    when 'hp' then 'desc' when 'rarity' then 'desc' end);
  if v_dir not in ('asc', 'desc') then
    raise exception 'VALIDATION_FAILED: ord must be asc or desc' using errcode = 'PT422';
  end if;

  if v_q is not null then
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- sort key expression (single key + id as stable tie-breaker; NULLs always last)
  if sort = 'name' then
    v_key := 'lower(c.name) collate "C"';
    v_ktype := 'text';
  elsif sort = 'releaseDate' then
    v_key := '(coalesce(s.release_date, date ''1900-01-01'') - date ''1900-01-01'')::bigint * 1000000 + '
      || case when v_dir = 'desc'
           then '(999999 - least(coalesce(c.number_sort, 999999), 999999))'
           else 'least(coalesce(c.number_sort, 999999), 999999)' end;
    v_ktype := 'bigint';
  elsif sort = 'number' then
    v_key := case when v_dir = 'asc' then 'coalesce(c.number_sort, 2147483647)' else 'coalesce(c.number_sort, -1)' end;
    v_ktype := 'bigint';
  elsif sort = 'hp' then
    v_key := case when v_dir = 'asc' then 'coalesce(c.hp_value, 2147483647)' else 'coalesce(c.hp_value, -1)' end;
    v_ktype := 'bigint';
  else -- rarity
    v_key := case when v_dir = 'asc' then 'coalesce(r.sort_order, 2147483647)' else 'coalesce(r.sort_order, -1)' end;
    v_ktype := 'bigint';
  end if;

  if page_cursor is not null then
    begin
      v_cur := convert_from(decode(page_cursor, 'base64'), 'utf8')::jsonb;
      if v_cur->>'s' is distinct from sort or v_cur->>'o' is distinct from v_dir
         or v_cur->>'k' is null or v_cur->>'id' is null then
        raise exception 'mismatch';
      end if;
      if v_ktype = 'bigint' then
        perform (v_cur->>'k')::bigint;
      end if;
    exception when others then
      raise exception 'BAD_REQUEST: invalid cursor' using errcode = 'PT400';
    end;
    v_cmp := case when v_dir = 'asc' then '>' else '<' end;
    v_cursor_clause := format(
      ' and ((%1$s) %2$s $7::%3$s or ((%1$s) = $7::%3$s and c.id > $8))', v_key, v_cmp, v_ktype);
  end if;

  v_sql := format($f$
    with page as (
      select c.id, c.name, c.number, c.rarity, c.image_small_url, c.set_id,
             s.name as set_name,
             (uc.card_id is not null) as is_owned,
             (w.card_id is not null) as is_wished,
             (%1$s) as k
      from public.cards c
      join public.card_sets s on s.id = c.set_id
      left join public.rarities r on r.name = c.rarity
      left join public.user_cards uc on uc.card_id = c.id and uc.user_id = $6
      left join public.wishlist_items w on w.card_id = c.id and w.user_id = $6
      where (c.is_active or ($5 = 'owned' and uc.card_id is not null))
        and ($1 is null or c.name ilike $1)
        and ($2 is null or cardinality($2) = 0 or c.set_id = any($2))
        and ($4 is null or cardinality($4) = 0 or c.rarity = any($4))
        and ($3 is null or cardinality($3) = 0 or exists (
              select 1 from public.card_types t where t.card_id = c.id and t.type_name = any($3)))
        and ($5 = 'all' or ($5 = 'owned' and uc.card_id is not null) or ($5 = 'unowned' and uc.card_id is null))
        %2$s
      order by k %3$s, c.id asc
      limit $9
    )
    select coalesce(jsonb_agg(
      (jsonb_build_object(
          'id', p.id, 'name', p.name, 'number', p.number, 'rarity', p.rarity,
          'imageSmall', p.image_small_url,
          'set', jsonb_build_object('id', p.set_id, 'name', p.set_name),
          'types', (select coalesce(jsonb_agg(t.type_name order by t.type_name), '[]'::jsonb)
                    from public.card_types t where t.card_id = p.id),
          '_k', p.k::text)
        || case when $6 is not null
             then jsonb_build_object('owned', p.is_owned, 'wished', p.is_wished)
             else '{}'::jsonb end)
      order by p.k %3$s, p.id asc
    ), '[]'::jsonb)
    from page p
  $f$, v_key, v_cursor_clause, v_dir);

  execute v_sql into v_rows
    using v_pat, set_ids, types, rarities, owned, v_uid, (v_cur->>'k'), (v_cur->>'id'), lim + 1;

  v_has_next := jsonb_array_length(v_rows) > lim;
  if v_has_next then
    v_rows := v_rows - lim;
  end if;

  if v_has_next then
    v_last := v_rows -> (jsonb_array_length(v_rows) - 1);
    v_next := replace(encode(convert_to(
      jsonb_build_object('s', sort, 'o', v_dir, 'k', v_last->>'_k', 'id', v_last->>'id')::text,
      'utf8'), 'base64'), E'\n', '');
  end if;

  select coalesce(jsonb_agg(e - '_k' order by n), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(v_rows) with ordinality as t(e, n);

  return jsonb_build_object(
    'data', v_items,
    'page', jsonb_build_object('limit', lim, 'nextCursor', v_next, 'hasNext', v_has_next));
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.get_card(card_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
  v_res jsonb;
begin
  select jsonb_build_object(
      'id', c.id, 'name', c.name, 'supertype', c.supertype, 'subtypes', c.subtypes,
      'hp', c.hp_value, 'number', c.number, 'rarity', c.rarity, 'artist', c.artist,
      'imageSmall', c.image_small_url, 'imageLarge', c.image_large_url,
      'nationalDexNumbers', c.national_dex_numbers, 'details', c.details,
      'isActive', c.is_active,
      'types', (select coalesce(jsonb_agg(t.type_name order by t.type_name), '[]'::jsonb)
                from public.card_types t where t.card_id = c.id),
      'set', jsonb_build_object(
        'id', s.id, 'name', s.name, 'series', s.series, 'releaseDate', s.release_date,
        'printedTotal', s.printed_total, 'total', s.total, 'logo', s.logo_url, 'symbol', s.symbol_url))
    || case when v_uid is not null then jsonb_build_object(
         'owned',  exists (select 1 from public.user_cards u where u.card_id = c.id and u.user_id = v_uid),
         'wished', exists (select 1 from public.wishlist_items w where w.card_id = c.id and w.user_id = v_uid))
       else '{}'::jsonb end
  into v_res
  from public.cards c
  join public.card_sets s on s.id = c.set_id
  where c.id = get_card.card_id;

  if v_res is null then
    raise exception 'NOT_FOUND: card not found' using errcode = 'PT404';
  end if;
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.list_sets()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'series', s.series, 'releaseDate', s.release_date,
      'total', s.total, 'printedTotal', s.printed_total,
      'symbol', s.symbol_url, 'logo', s.logo_url)
    order by s.release_date desc nulls last, s.id), '[]'::jsonb)
  from public.card_sets s
  where s.is_active;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.get_filters()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'types', (select coalesce(jsonb_agg(x.type_name order by x.type_name), '[]'::jsonb)
              from (select distinct t.type_name from public.card_types t
                    join public.cards c on c.id = t.card_id and c.is_active) x),
    'rarities', (select coalesce(jsonb_agg(y.rarity order by y.ord, y.rarity), '[]'::jsonb)
                 from (select c.rarity, coalesce(max(r.sort_order), 2147483647) as ord
                       from public.cards c
                       left join public.rarities r on r.name = c.rarity
                       where c.is_active and c.rarity is not null
                       group by c.rarity) y),
    'supertypes', (select coalesce(jsonb_agg(z.supertype order by z.supertype), '[]'::jsonb)
                   from (select distinct c.supertype from public.cards c
                         where c.is_active and c.supertype is not null) z));
$$;

-- ---------------------------------------------------------------------------
create or replace function public.list_wishlist(
  lim         int  default 30,
  page_cursor text default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_cur  jsonb;
  v_rows jsonb;
  v_has_next boolean;
  v_last jsonb;
  v_next text := null;
  v_items jsonb;
  v_k    bigint;
  v_id   text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: login required' using errcode = 'PT401';
  end if;
  if lim is null or lim < 1 or lim > 100 then
    raise exception 'VALIDATION_FAILED: lim must be between 1 and 100' using errcode = 'PT422';
  end if;

  if page_cursor is not null then
    begin
      v_cur := convert_from(decode(page_cursor, 'base64'), 'utf8')::jsonb;
      v_k := (v_cur->>'k')::bigint;
      v_id := v_cur->>'id';
      if v_id is null then raise exception 'bad'; end if;
    exception when others then
      raise exception 'BAD_REQUEST: invalid cursor' using errcode = 'PT400';
    end;
  end if;

  with page as (
    select c.id, c.name, c.number, c.rarity, c.image_small_url, c.set_id, s.name as set_name,
           (uc.card_id is not null) as is_owned,
           (extract(epoch from w.created_at) * 1000000)::bigint as k
    from public.wishlist_items w
    join public.cards c on c.id = w.card_id
    join public.card_sets s on s.id = c.set_id
    left join public.user_cards uc on uc.card_id = c.id and uc.user_id = v_uid
    where w.user_id = v_uid
      and (v_k is null
           or (extract(epoch from w.created_at) * 1000000)::bigint < v_k
           or ((extract(epoch from w.created_at) * 1000000)::bigint = v_k and c.id > v_id))
    order by k desc, c.id asc
    limit lim + 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'number', p.number, 'rarity', p.rarity,
      'imageSmall', p.image_small_url,
      'set', jsonb_build_object('id', p.set_id, 'name', p.set_name),
      'types', (select coalesce(jsonb_agg(t.type_name order by t.type_name), '[]'::jsonb)
                from public.card_types t where t.card_id = p.id),
      'owned', p.is_owned, 'wished', true, '_k', p.k::text)
    order by p.k desc, p.id asc), '[]'::jsonb)
  into v_rows
  from page p;

  v_has_next := jsonb_array_length(v_rows) > lim;
  if v_has_next then
    v_rows := v_rows - lim;
    v_last := v_rows -> (jsonb_array_length(v_rows) - 1);
    v_next := replace(encode(convert_to(
      jsonb_build_object('k', v_last->>'_k', 'id', v_last->>'id')::text, 'utf8'), 'base64'), E'\n', '');
  end if;

  select coalesce(jsonb_agg(e - '_k' order by n), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(v_rows) with ordinality as t(e, n);

  return jsonb_build_object(
    'data', v_items,
    'page', jsonb_build_object('limit', lim, 'nextCursor', v_next, 'hasNext', v_has_next));
end;
$$;

-- ---------------------------------------------------------------------------
revoke execute on function public.list_cards(text, text[], text[], text[], text, text, text, int, text) from public;
revoke execute on function public.get_card(text) from public;
revoke execute on function public.list_sets() from public;
revoke execute on function public.get_filters() from public;
revoke execute on function public.list_wishlist(int, text) from public;

grant execute on function public.list_cards(text, text[], text[], text[], text, text, text, int, text) to anon, authenticated;
grant execute on function public.get_card(text) to anon, authenticated;
grant execute on function public.list_sets() to anon, authenticated;
grant execute on function public.get_filters() to anon, authenticated;
grant execute on function public.list_wishlist(int, text) to authenticated;
