-- Korean card names (docs/12 §Korean names).
-- Source of truth stays the English catalog; `cards.name_ko` is derived:
--   1) exact overrides (ko_name_overrides: operator-curated, e.g. basic energy, trainers)
--   2) Pokémon cards: English species name -> Korean (from PokeAPI CSV via sync-species), keeping the
--      remaining tokens (ex, V, VMAX, ...) and mapping known prefixes (Alolan -> 알로라, ...)
-- Cards with no confident translation keep name_ko = NULL and the app falls back to the English name.

alter table public.cards add column if not exists name_ko text;

create table if not exists public.pokemon_species (
  dex     int primary key,
  name_en text not null,
  name_ko text
);

create table if not exists public.ko_name_modifiers (
  en   text primary key,
  ko   text not null,
  glue text not null default ' '
);

create table if not exists public.ko_name_overrides (
  en_name text primary key,
  ko_name text not null,
  source  text not null default 'manual'
);

alter table public.pokemon_species    enable row level security;
alter table public.ko_name_modifiers  enable row level security;
alter table public.ko_name_overrides  enable row level security;
revoke all on public.pokemon_species, public.ko_name_modifiers, public.ko_name_overrides from anon, authenticated;

-- normalization is strictly 1 char -> 1 char so positions in the normalized string match the original
create or replace function public.ko_norm(s text) returns text
language sql immutable parallel safe as $$
  select lower(translate(s, 'éÉ’‘`', 'eE'''''''))
$$;

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

  v_out := p_name;
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

  -- known prefixes (longest first), applied repeatedly for combinations such as "Dark Alolan ..."
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

revoke all on function public.ko_card_name(text, jsonb, text) from public, anon, authenticated;

create or replace function public.cards_set_name_ko() returns trigger
language plpgsql
as $$
begin
  new.name_ko := public.ko_card_name(new.name, new.national_dex_numbers, new.supertype);
  return new;
end;
$$;

drop trigger if exists cards_name_ko_trg on public.cards;
create trigger cards_name_ko_trg
  before insert or update of name, national_dex_numbers, supertype on public.cards
  for each row execute function public.cards_set_name_ko();

create index if not exists cards_name_ko_trgm_idx on public.cards using gin (name_ko extensions.gin_trgm_ops);

-- prefixes confirmed against official Korean card naming
insert into public.ko_name_modifiers (en, ko, glue) values
  ('Alolan',        '알로라',   ' '),
  ('Galarian',      '가라르',   ' '),
  ('Hisuian',       '히스이',   ' '),
  ('Paldean',       '팔데아',   ' '),
  ('Team Rocket''s','로켓단의', ' '),
  ('Dark',          '나쁜',     ' '),
  ('Radiant',       '찬란한',   ' '),
  ('Shining',       '빛나는',   ' '),
  ('Mega',          '메가',     '')
on conflict (en) do update set ko = excluded.ko, glue = excluded.glue;

-- basic energy names, validated against the official Korean card list
insert into public.ko_name_overrides (en_name, ko_name, source)
select e.pre || t.en || ' Energy', '기본 ' || t.ko || ' 에너지', 'official-kr-list'
from (values ('Basic '), ('')) as e(pre)
cross join (values
  ('Grass','풀'), ('Fire','불꽃'), ('Water','물'), ('Lightning','번개'), ('Psychic','초'),
  ('Fighting','격투'), ('Darkness','악'), ('Metal','강철'), ('Fairy','페어리')
) as t(en, ko)
on conflict (en_name) do update set ko_name = excluded.ko_name;
