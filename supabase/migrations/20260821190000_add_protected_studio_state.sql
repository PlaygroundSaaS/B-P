create table if not exists public.studio_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint studio_state_id_check check (id = 'bramble-petal')
);

alter table public.studio_state enable row level security;
revoke all on table public.studio_state from anon, authenticated;
grant select, insert, update, delete on table public.studio_state to service_role;

