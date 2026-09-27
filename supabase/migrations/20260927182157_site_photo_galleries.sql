-- Website photo galleries Jade arranges in the Studio (Website photos).
-- One row per gallery holds its photos in order, so a save replaces the whole
-- list at once. With no row, the website shows the gallery's starting photos
-- from lib/site-photos.ts. Uploaded photos are files in the private
-- studio-assets bucket under bramble-petal-main/website/, served publicly by
-- /site-photos/<id> only while a saved gallery lists them.
create table if not exists public.site_photo_galleries (
  workspace_key text not null references public.studio_app_state(workspace_key),
  gallery text not null check (gallery ~ '^[a-z0-9-]{1,40}$'),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 60),
  updated_at timestamptz not null default now(),
  primary key (workspace_key, gallery)
);
alter table public.site_photo_galleries enable row level security;
revoke all on public.site_photo_galleries from public, anon, authenticated;
grant select, insert, update, delete on public.site_photo_galleries to service_role;
comment on table public.site_photo_galleries is 'Server-only. Ordered photo lists for the public website galleries, edited in the Studio.';
