-- Remove the first-generation Studio Hub tables. The Studio moved to
-- studio_app_state in August 2026; these tables hold no business records
-- (settings only held the old defaults) and no code reads them any more.
do $$
begin
  if exists (select 1 from public.clients) or exists (select 1 from public.flowers)
    or exists (select 1 from public.stock_log) or exists (select 1 from public.materials)
    or exists (select 1 from public.purchases) or exists (select 1 from public.meeting_notes)
    or exists (select 1 from public.plans) or exists (select 1 from public.dream_selections)
    or exists (select 1 from public.portfolio_items) or exists (select 1 from public.studio_state) then
    raise exception 'Legacy Studio Hub tables contain records; nothing was dropped.';
  end if;
end;
$$;

drop table public.dream_selections;
drop table public.meeting_notes;
drop table public.plans;
drop table public.stock_log;
drop table public.flowers;
drop table public.clients;
drop table public.purchases;
drop table public.materials;
drop table public.portfolio_items;
drop table public.settings;
drop table public.studio_state;
drop function if exists public.set_updated_at();
