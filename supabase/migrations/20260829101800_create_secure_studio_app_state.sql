create table if not exists public.studio_app_state (
  workspace_key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.studio_app_state enable row level security;

comment on table public.studio_app_state is
  'Private Bramble and Petal Studio workspace state. Accessed only by the server after custom Studio authentication.';

revoke all on table public.studio_app_state from anon, authenticated;
grant all on table public.studio_app_state to service_role;

drop policy if exists "Server-only Studio workspace access" on public.studio_app_state;
create policy "Server-only Studio workspace access"
on public.studio_app_state
for all
to service_role
using (true)
with check (true);

insert into public.studio_app_state (workspace_key, data)
values ('bramble-petal-main', '{}'::jsonb)
on conflict (workspace_key) do nothing;
