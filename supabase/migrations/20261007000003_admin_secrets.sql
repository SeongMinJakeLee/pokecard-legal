-- Operator-only secrets (sync token hash). No client access; service role bypasses RLS.
create table public.admin_secrets (
  name        text primary key,
  secret_hash text not null,
  created_at  timestamptz not null default now()
);
alter table public.admin_secrets enable row level security;
revoke all on public.admin_secrets from anon, authenticated;
