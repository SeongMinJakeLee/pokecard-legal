-- 001: core schema (docs/04-database-and-erd.md)
-- Catalog tables are read-only for clients (no write policies). Sync uses service role.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.card_sets (
  id               text primary key,
  name             text not null,
  series           text,
  printed_total    int,
  total            int,
  release_date     date,
  ptcgo_code       text,
  symbol_url       text,
  logo_url         text,
  language         text not null default 'en',
  source_updated_at timestamptz,
  synced_at        timestamptz not null default now(),
  is_active        boolean not null default true
);
create index card_sets_release_date_idx on public.card_sets (release_date desc);

create table public.cards (
  id                  text primary key,
  set_id              text not null references public.card_sets (id),
  name                text not null,
  supertype           text,
  hp_value            int,
  number              text,
  number_sort         int,
  rarity              text,
  artist              text,
  image_small_url     text,
  image_large_url     text,
  subtypes            jsonb not null default '[]'::jsonb,
  national_dex_numbers jsonb not null default '[]'::jsonb,
  details             jsonb not null default '{}'::jsonb,
  language            text not null default 'en',
  is_active           boolean not null default true,
  synced_at           timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index cards_set_number_idx on public.cards (is_active, set_id, number_sort, id);
create index cards_name_trgm_idx on public.cards using gin (name extensions.gin_trgm_ops);
create index cards_rarity_idx on public.cards (rarity);
create index cards_hp_idx on public.cards (hp_value, id);

create table public.card_types (
  card_id   text not null references public.cards (id) on delete cascade,
  type_name text not null,
  primary key (card_id, type_name)
);
create index card_types_type_idx on public.card_types (type_name, card_id);

create table public.rarities (
  name       text primary key,
  sort_order int not null
);

create table public.sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  job_type        text not null,
  status          text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  items_processed int not null default 0,
  items_failed    int not null default 0,
  error_message   text
);
create index sync_jobs_type_started_idx on public.sync_jobs (job_type, started_at desc);

-- ---------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text,
  terms_agreed_at  timestamptz,
  terms_version    text,
  age_verified_at  timestamptz,
  created_at       timestamptz not null default now()
);

create table public.user_cards (
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    text not null references public.cards (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index user_cards_card_idx on public.user_cards (card_id);

create table public.wishlist_items (
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    text not null references public.cards (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index wishlist_user_created_idx on public.wishlist_items (user_id, created_at desc);
create index wishlist_card_idx on public.wishlist_items (card_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.card_sets      enable row level security;
alter table public.cards          enable row level security;
alter table public.card_types     enable row level security;
alter table public.rarities       enable row level security;
alter table public.sync_jobs      enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_cards     enable row level security;
alter table public.wishlist_items enable row level security;

-- Catalog: public read, no client writes
create policy card_sets_read  on public.card_sets  for select to anon, authenticated using (true);
create policy cards_read      on public.cards      for select to anon, authenticated using (true);
create policy card_types_read on public.card_types for select to anon, authenticated using (true);
create policy rarities_read   on public.rarities   for select to anon, authenticated using (true);

-- sync_jobs: no policies (service role only)

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_cards
create policy user_cards_select_own on public.user_cards for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_cards_insert_own on public.user_cards for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_cards_delete_own on public.user_cards for delete to authenticated
  using (user_id = (select auth.uid()));

-- wishlist_items
create policy wishlist_select_own on public.wishlist_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy wishlist_insert_own on public.wishlist_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wishlist_delete_own on public.wishlist_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- Least privilege on table grants (RLS remains the main line of defense)
revoke all on public.card_sets, public.cards, public.card_types, public.rarities,
  public.sync_jobs, public.profiles, public.user_cards, public.wishlist_items from anon, authenticated;
grant select on public.card_sets, public.cards, public.card_types, public.rarities to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.user_cards, public.wishlist_items to authenticated;
