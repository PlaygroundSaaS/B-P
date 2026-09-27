-- Up to three photographs a client attaches to their review. The files live in
-- the private review-photos bucket and the website serves them through
-- /api/reviews/<review>/photos/<photo> only while the review is published.
alter table public.studio_reviews
  add column if not exists photos uuid[] not null default '{}';
alter table public.studio_reviews
  add constraint review_photos_limit check (cardinality(photos) <= 3);
alter table public.studio_reviews
  add constraint photos_require_submission check (cardinality(photos) = 0 or submitted_at is not null);

-- No anonymous/authenticated Storage policies are granted for this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', false, 1400000, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
