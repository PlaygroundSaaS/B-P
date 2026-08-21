create table if not exists public.studio_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.studio_state enable row level security;
grant select, insert, update on table public.studio_state to authenticated;

create policy "studio owner can read" on public.studio_state
for select to authenticated using ((select auth.uid()) = owner_id);
create policy "studio owner can insert" on public.studio_state
for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "studio owner can update" on public.studio_state
for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

