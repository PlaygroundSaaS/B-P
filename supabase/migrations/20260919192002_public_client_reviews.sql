create table if not exists public.studio_reviews (
 id uuid primary key default gen_random_uuid(),
 workspace_key text not null,
 client_label text not null check(char_length(client_label) between 1 and 120),
 token_hash text not null unique check(char_length(token_hash)=64),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days'),
 revoked_at timestamptz,
 public_name text check(char_length(public_name) between 1 and 80),
 review_text text check(char_length(review_text) between 10 and 2000),
 rating smallint check(rating between 1 and 5),
 occasion text check(occasion in ('Wedding','Funeral flowers','Corporate event','Everyday flowers','Other')),
 consent boolean not null default false,
 submitted_at timestamptz,
 published boolean not null default false,
 constraint complete_submitted_review check (submitted_at is null or (public_name is not null and review_text is not null and rating is not null and occasion is not null and consent)),
 constraint published_review_requires_submission check (not published or submitted_at is not null)
);
alter table public.studio_reviews enable row level security;
revoke all on public.studio_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.studio_reviews to service_role;
create index if not exists studio_reviews_public_idx on public.studio_reviews(workspace_key,submitted_at desc) where published=true;
create index if not exists studio_reviews_admin_idx on public.studio_reviews(workspace_key,created_at desc);
comment on table public.studio_reviews is 'Server-only review invitations and consented testimonials. Public API projects published review fields; invitation hashes and client labels remain private.';