-- Optional highlight quote the Studio picks from a submitted review. The
-- website shows it in large type with the full review behind "Read full review".
-- The Studio API only accepts passages copied word for word from review_text.
alter table public.studio_reviews
  add column if not exists highlight text
  check (highlight is null or char_length(highlight) between 3 and 280);
alter table public.studio_reviews
  drop constraint if exists highlight_requires_submission;
alter table public.studio_reviews
  add constraint highlight_requires_submission check (highlight is null or submitted_at is not null);
