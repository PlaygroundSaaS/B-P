-- Supplier invoices remain private. The authenticated Next.js server alone
-- reads photographs, reserves paid scans and confirms reviewed inventory.
begin;

create table public.supplier_invoice_imports (
  id uuid primary key,
  workspace_key text not null,
  content_hash text not null,
  filename text not null,
  storage_path text not null,
  -- Assisted imports may archive a small original through the database API
  -- before the application's Storage credentials are configured.
  source_image_base64 text check (length(source_image_base64) <= 4194304),
  source_image_media_type text check (source_image_media_type in ('image/jpeg', 'image/png', 'image/webp')),
  status text not null default 'processing'
    check (status in ('processing', 'review', 'imported', 'failed')),
  draft jsonb,
  extraction jsonb,
  error_message text,
  model text not null,
  usage jsonb,
  estimated_cost_usd numeric check (estimated_cost_usd >= 0),
  created_by text not null,
  invoice_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  imported_at timestamptz,
  attempts integer not null default 1 check (attempts between 1 and 3),
  constraint supplier_invoice_imports_content_unique
    unique (workspace_key, content_hash),
  constraint supplier_invoice_imports_imported_details
    check (status <> 'imported' or (invoice_key is not null and imported_at is not null))
);

create unique index supplier_invoice_imports_invoice_unique
  on public.supplier_invoice_imports (workspace_key, invoice_key)
  where status = 'imported';

create index supplier_invoice_imports_workspace_created
  on public.supplier_invoice_imports (workspace_key, created_at desc);

create index supplier_invoice_imports_processing
  on public.supplier_invoice_imports (workspace_key, updated_at)
  where status = 'processing';

alter table public.supplier_invoice_imports enable row level security;
revoke all on table public.supplier_invoice_imports from public, anon, authenticated;
grant select, insert, update, delete on table public.supplier_invoice_imports to service_role;

comment on table public.supplier_invoice_imports is
  'Private supplier invoice photographs, extraction audit and reviewed import receipts. No browser role access.';

-- No anonymous/authenticated Storage policies are granted for this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-invoices', 'supplier-invoices', false, 3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.reserve_supplier_invoice(
  p_id uuid,
  p_workspace text,
  p_hash text,
  p_filename text,
  p_storage_path text,
  p_model text,
  p_actor text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.supplier_invoice_imports%rowtype;
  v_existing boolean;
  v_now timestamptz;
  v_day_start timestamptz;
begin
  if p_id is null
    or p_workspace is null or btrim(p_workspace) = '' or length(p_workspace) > 200
    or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or p_filename is null or btrim(p_filename) = '' or length(p_filename) > 180
    or p_storage_path is null or length(p_storage_path) > 512
    or left(p_storage_path, length(p_workspace) + 1) <> p_workspace || '/'
    or p_model is null or btrim(p_model) = '' or length(p_model) > 200
    or p_actor is null or btrim(p_actor) = '' or length(p_actor) > 200 then
    raise exception using errcode = '22023', message = 'Invalid invoice reservation parameters.';
  end if;

  -- All invoice RPCs acquire this transaction-scoped workspace lock first.
  -- It serializes reservations without holding any lock during model calls.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('supplier-invoices:' || p_workspace, 0)
  );
  v_now := clock_timestamp();
  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';

  if not exists (
    select 1 from public.studio_app_state where workspace_key = p_workspace
  ) then
    raise exception using errcode = 'P0001', message = 'Save the Studio workspace before scanning an invoice.';
  end if;

  select * into v_invoice
  from public.supplier_invoice_imports
  where workspace_key = p_workspace and content_hash = p_hash
  for update;
  v_existing := found;

  if v_existing then
    if v_invoice.status in ('review', 'imported')
      or (v_invoice.status = 'processing' and v_invoice.updated_at > v_now - interval '180 seconds') then
      return jsonb_build_object('invoice', to_jsonb(v_invoice), 'reserved', false);
    end if;
    if v_invoice.attempts >= 3 then
      raise exception using errcode = 'P0001', message = 'This photograph has reached the three-attempt scanning limit.';
    end if;
  end if;

  if exists (
    select 1 from public.supplier_invoice_imports
    where workspace_key = p_workspace
      and status = 'processing'
      and updated_at > v_now - interval '180 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'Another invoice scan is still in progress.';
  end if;

  if v_existing then
    -- Reuse the receipt ID and private photograph path. The server must match
    -- this attempt number when recording extraction success or failure.
    update public.supplier_invoice_imports
    set status = 'processing', attempts = attempts + 1, updated_at = v_now,
        error_message = null, model = p_model, created_by = p_actor,
        draft = null, extraction = null, usage = null, estimated_cost_usd = null
    where id = v_invoice.id
    returning * into v_invoice;
  else
    if (
      select count(*) from public.supplier_invoice_imports
      where workspace_key = p_workspace and created_at >= v_day_start
    ) >= 30 then
      raise exception using errcode = 'P0001', message = 'The daily limit of thirty new invoice scans has been reached.';
    end if;

    insert into public.supplier_invoice_imports (
      id, workspace_key, content_hash, filename, storage_path, model, created_by,
      created_at, updated_at
    ) values (
      p_id, p_workspace, p_hash, p_filename, p_storage_path, p_model, p_actor,
      v_now, v_now
    ) returning * into v_invoice;
  end if;

  return jsonb_build_object('invoice', to_jsonb(v_invoice), 'reserved', true);
end;
$$;

revoke execute on function public.reserve_supplier_invoice(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_supplier_invoice(uuid, text, text, text, text, text, text)
  to service_role;

drop function if exists public.confirm_supplier_invoice(uuid, text, jsonb, jsonb, text);
create or replace function public.confirm_supplier_invoice(
  p_id uuid,
  p_workspace text,
  p_draft jsonb,
  p_items jsonb,
  p_invoice_key text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.supplier_invoice_imports%rowtype;
  v_state public.studio_app_state%rowtype;
  v_inventory jsonb;
  v_item jsonb;
  v_data jsonb;
  v_updated_at timestamptz;
  v_quantity numeric;
  v_remaining numeric;
  v_cost numeric;
begin
  if p_id is null or p_workspace is null or btrim(p_workspace) = '' then
    raise exception using errcode = '22023', message = 'Invalid invoice confirmation parameters.';
  end if;

  -- Consistent order: workspace advisory lock, Studio row, then invoice row.
  -- Normal Studio saves also lock their row, preventing lost inventory updates.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('supplier-invoices:' || p_workspace, 0)
  );
  select * into v_state
  from public.studio_app_state
  where workspace_key = p_workspace
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'The Studio workspace does not exist.';
  end if;

  select * into v_invoice
  from public.supplier_invoice_imports
  where id = p_id and workspace_key = p_workspace
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'The supplier invoice does not exist in this workspace.';
  end if;
  if v_invoice.status = 'imported' then
    return jsonb_build_object(
      'data', v_state.data, 'updatedAt', v_state.updated_at, 'alreadyImported', true
    );
  end if;
  if v_invoice.status <> 'review' then
    raise exception using errcode = 'P0001', message = 'Review the invoice before adding it to inventory.';
  end if;

  if v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'This invoice review changed. Reopen it before confirming.';
  end if;

  if jsonb_typeof(p_draft) is distinct from 'object'
    or p_invoice_key is null or p_invoice_key !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'A reviewed invoice and canonical invoice key are required.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Inventory additions must be an array.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Import between one and one hundred inventory items.';
  end if;
  if jsonb_typeof(v_state.data) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Existing Studio data is not an object; no records were changed.';
  end if;
  v_inventory := coalesce(v_state.data -> 'inventory', '[]'::jsonb);
  if jsonb_typeof(v_inventory) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Existing inventory is not an array; no records were changed.';
  end if;

  -- The route performs full invoice validation. These checks independently
  -- protect the final atomic write from malformed or colliding stock batches.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'id') is distinct from 'string'
      or btrim(v_item ->> 'id') = '' or length(v_item ->> 'id') > 160
      or jsonb_typeof(v_item -> 'name') is distinct from 'string'
      or btrim(v_item ->> 'name') = '' or length(v_item ->> 'name') > 220
      or (v_item ->> 'supplierInvoiceId') is distinct from p_id::text
      or jsonb_typeof(v_item -> 'stemsPurchased') is distinct from 'number'
      or jsonb_typeof(v_item -> 'stemsRemaining') is distinct from 'number'
      or jsonb_typeof(v_item -> 'costPerStem') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'Inventory items require valid IDs, names, quantities and costs.';
    end if;
    v_quantity := (v_item ->> 'stemsPurchased')::numeric;
    v_remaining := (v_item ->> 'stemsRemaining')::numeric;
    v_cost := (v_item ->> 'costPerStem')::numeric;
    if v_quantity <= 0 or v_quantity > 1000000 or v_quantity <> trunc(v_quantity)
      or v_remaining <> v_quantity
      or v_cost < 0 or v_cost > 1000000 or v_cost <> round(v_cost, 4) then
      raise exception using errcode = '22023', message = 'Inventory quantities and costs are outside the supported range.';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_items) as added(item)
    group by added.item ->> 'id' having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_items) as added(item)
    join jsonb_array_elements(v_inventory) as existing(item)
      on added.item ->> 'id' = existing.item ->> 'id'
  ) then
    raise exception using errcode = '23505', message = 'An invoice inventory item has already been added.';
  end if;

  -- Set the unique business invoice key first; any duplicate aborts the entire
  -- transaction. jsonb_set preserves every other Studio field and old batch.
  v_updated_at := greatest(clock_timestamp(), v_state.updated_at + interval '1 microsecond');
  update public.supplier_invoice_imports
  set status = 'imported', draft = p_draft, invoice_key = p_invoice_key,
      imported_at = v_updated_at, updated_at = v_updated_at, error_message = null
  where id = p_id and workspace_key = p_workspace;

  v_data := jsonb_set(v_state.data, '{inventory}', p_items || v_inventory, true);
  update public.studio_app_state
  set data = v_data, updated_at = v_updated_at
  where workspace_key = p_workspace;

  return jsonb_build_object(
    'data', v_data, 'updatedAt', v_updated_at, 'alreadyImported', false
  );
end;
$$;

revoke execute on function public.confirm_supplier_invoice(uuid, text, jsonb, jsonb, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.confirm_supplier_invoice(uuid, text, jsonb, jsonb, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;
