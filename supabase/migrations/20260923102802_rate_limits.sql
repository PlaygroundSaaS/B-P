-- Rate limits for Studio sign-in and public website enquiries.
-- Server-only: the Next.js routes call studio_rate_limit with the service role.
-- Visitor addresses are stored only as keyed hashes and are kept for two days.
create table if not exists public.studio_rate_events (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (char_length(bucket) between 1 and 60),
  key_hash text not null check (char_length(key_hash) between 1 and 128),
  created_at timestamptz not null default now()
);
create index if not exists studio_rate_events_lookup
  on public.studio_rate_events (bucket, key_hash, created_at desc);
create index if not exists studio_rate_events_created
  on public.studio_rate_events (created_at);

alter table public.studio_rate_events enable row level security;
revoke all on table public.studio_rate_events from public, anon, authenticated;
grant select, insert, delete on table public.studio_rate_events to service_role;
comment on table public.studio_rate_events is
  'Server-only rate-limit events for Studio sign-in and website enquiries. No browser role access.';

-- Returns false when the limit has been reached. When p_record is true and the
-- request is allowed, the event is counted. An advisory lock per bucket/key keeps
-- concurrent requests from slipping past the limit.
create or replace function public.studio_rate_limit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_record boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_bucket is null or btrim(p_bucket) = '' or p_key is null or btrim(p_key) = ''
    or p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception using errcode = '22023', message = 'Invalid rate limit parameters.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('studio-rate:' || p_bucket || ':' || p_key, 0)
  );
  delete from public.studio_rate_events where created_at < now() - interval '2 days';
  select count(*) into v_count
  from public.studio_rate_events
  where bucket = p_bucket
    and key_hash = p_key
    and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;
  if p_record then
    insert into public.studio_rate_events (bucket, key_hash) values (p_bucket, p_key);
  end if;
  return true;
end;
$$;
revoke execute on function public.studio_rate_limit(text, text, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.studio_rate_limit(text, text, integer, integer, boolean)
  to service_role;
