create extension if not exists pgcrypto;

create table if not exists public.settings (
  key text primary key,
  value text
);

insert into public.settings (key, value) values
  ('vat_pct', '20'),
  ('default_markup_pct', '100'),
  ('client_markup_pct', '150'),
  ('currency_symbol', '£'),
  ('anthropic_api_key', '')
on conflict (key) do nothing;

create table if not exists public.flowers (
  id text primary key,
  name text not null,
  colour text,
  cost_per_stem numeric not null default 0 check (cost_per_stem >= 0),
  stems_purchased integer not null default 0 check (stems_purchased >= 0),
  stems_remaining integer not null default 0 check (stems_remaining >= 0),
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_log (
  id text primary key,
  flower_id text not null references public.flowers(id) on delete cascade,
  change integer not null,
  reason text not null,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id text primary key,
  name text not null,
  cost numeric not null default 0 check (cost >= 0),
  unit text not null default 'item',
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id text primary key,
  customer_name text not null,
  customer_contact text,
  job_type text,
  event_date date,
  breakdown_json jsonb not null,
  flowers_cost numeric not null,
  materials_cost numeric not null,
  markup_pct numeric not null,
  subtotal numeric not null,
  vat_pct numeric not null,
  vat_amount numeric not null,
  total numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id text primary key,
  name text not null,
  event_type text not null default 'Wedding',
  event_date date,
  contact text,
  venue text,
  budget numeric,
  status text not null default 'Enquiry'
    check (status in ('Enquiry','Consultation booked','Proposal sent','Confirmed','Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_notes (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  meeting_date timestamptz not null default now(),
  raw_notes text not null,
  ai_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  client_id text not null unique references public.clients(id) on delete cascade,
  content text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dream_selections (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  flower_lines jsonb not null,
  notes text,
  estimated_total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id text primary key,
  title text not null,
  category text not null default 'Wedding',
  description text,
  image_path text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists clients_event_date_idx on public.clients(event_date);
create index if not exists purchases_created_at_idx on public.purchases(created_at desc);
create index if not exists stock_log_flower_id_idx on public.stock_log(flower_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists flowers_set_updated_at on public.flowers;
create trigger flowers_set_updated_at before update on public.flowers
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
alter table public.flowers enable row level security;
alter table public.stock_log enable row level security;
alter table public.materials enable row level security;
alter table public.purchases enable row level security;
alter table public.clients enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.plans enable row level security;
alter table public.dream_selections enable row level security;
alter table public.portfolio_items enable row level security;