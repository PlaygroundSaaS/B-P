create policy "Server-only Studio workspace access"
on public.studio_app_state
for all
to service_role
using (true)
with check (true);