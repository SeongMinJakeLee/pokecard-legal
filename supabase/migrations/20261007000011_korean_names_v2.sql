-- Korean names v2: Nidoran symbols, owner prefixes (gym leaders, teams), "M" mega prefix.
create or replace function public.ko_card_name(p_name text, p_dex jsonb, p_supertype text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out text;
  v_ko  text;
  d     jsonb;
  sp    record;
  pos   int;
  hit   boolean := false;
  m     record;
  guard int := 0;
begin
  select ko_name into v_ko from public.ko_name_overrides where en_name = p_name;
  if v_ko is not null then
    return v_ko;
  end if;

  if p_supertype is distinct from 'Pokémon' or p_dex is null or jsonb_typeof(p_dex) <> 'array' then
    return null;
  end if;

  -- PokeAPI writes "Nidoran♀" without a space
  v_out := replace(replace(p_name, ' ♀', '♀'), ' ♂', '♂');
  for d in select * from jsonb_array_elements(p_dex) loop
    select name_en, name_ko into sp from public.pokemon_species where dex = (d #>> '{}')::int;
    continue when sp.name_ko is null;
    pos := position(public.ko_norm(sp.name_en) in public.ko_norm(v_out));
    if pos > 0 then
      v_out := left(v_out, pos - 1) || sp.name_ko || substr(v_out, pos + char_length(sp.name_en));
      hit := true;
    end if;
  end loop;

  if not hit then
    return null;
  end if;

  loop
    guard := guard + 1;
    exit when guard > 3;
    select en, ko, glue into m
      from public.ko_name_modifiers
     where public.ko_norm(v_out) like public.ko_norm(en) || ' %'
     order by char_length(en) desc
     limit 1;
    exit when not found;
    v_out := m.ko || m.glue || substr(v_out, char_length(m.en) + 2);
  end loop;

  return v_out;
end;
$$;

insert into public.ko_name_modifiers (en, ko, glue) values
  ('M',             'M',        ''),
  ('Team Aqua''s',  '아쿠아단의', ' '),
  ('Team Magma''s', '마그마단의', ' '),
  ('Rocket''s',     '로켓단의',  ' '),
  ('Misty''s',      '이슬의',   ' '),
  ('Brock''s',      '웅의',     ' '),
  ('Lt. Surge''s',  '마티스의', ' '),
  ('Erika''s',      '민화의',   ' '),
  ('Sabrina''s',    '초련의',   ' '),
  ('Blaine''s',     '강연의',   ' '),
  ('Giovanni''s',   '비주기의', ' '),
  ('Koga''s',       '독수의',   ' '),
  ('N''s',          'N의',      ' ')
on conflict (en) do update set ko = excluded.ko, glue = excluded.glue;

select public.recompute_card_names_ko();
