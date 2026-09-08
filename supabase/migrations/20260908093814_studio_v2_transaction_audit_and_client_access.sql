-- Additive extension of the existing authoritative Studio workspace.
-- No existing records, authentication policies or supplier receipts are replaced.
create table if not exists public.studio_command_receipts (
  workspace_key text not null references public.studio_app_state(workspace_key),
  operation_id uuid not null,
  payload_hash text not null,
  action text not null,
  created_at timestamptz not null default now(),
  primary key(workspace_key, operation_id)
);
create table if not exists public.studio_audit_log (
  id uuid primary key default gen_random_uuid(), workspace_key text not null,
  operation_id uuid, actor text not null, action text not null, record_ids text[] not null default '{}',
  before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index if not exists studio_audit_workspace_date on public.studio_audit_log(workspace_key, created_at desc, id);
create index if not exists studio_audit_records on public.studio_audit_log using gin(record_ids);
create table if not exists public.studio_inventory_transactions (
  id uuid primary key default gen_random_uuid(), workspace_key text not null, operation_id uuid,
  inventory_id text not null, item_name text not null, quantity numeric not null, unit_cost numeric not null default 0,
  kind text not null, record_id text, actor text not null, created_at timestamptz not null default now()
);
create index if not exists studio_transactions_workspace_date on public.studio_inventory_transactions(workspace_key, created_at desc, id);
create index if not exists studio_transactions_item on public.studio_inventory_transactions(workspace_key, inventory_id, created_at desc);
create table if not exists public.studio_client_access (
  id uuid primary key default gen_random_uuid(), workspace_key text not null references public.studio_app_state(workspace_key),
  plan_id text not null, client_id text not null, token_hash text not null,
  revoked_at timestamptz, expires_at timestamptz not null default (now() + interval '180 days'), created_at timestamptz not null default now()
);
create index if not exists studio_client_access_plan on public.studio_client_access(workspace_key, plan_id);
create table if not exists public.studio_ai_generations (
  id uuid primary key, workspace_key text not null, kind text not null, status text not null,
  result jsonb, model text not null, usage jsonb, created_at timestamptz not null default now()
);
create index if not exists studio_ai_workspace_date on public.studio_ai_generations(workspace_key, created_at desc);

alter table public.studio_command_receipts enable row level security;
alter table public.studio_audit_log enable row level security;
alter table public.studio_inventory_transactions enable row level security;
alter table public.studio_client_access enable row level security;
alter table public.studio_ai_generations enable row level security;
revoke all on public.studio_command_receipts, public.studio_audit_log, public.studio_inventory_transactions, public.studio_client_access, public.studio_ai_generations from anon, authenticated;
grant all on public.studio_command_receipts, public.studio_audit_log, public.studio_inventory_transactions, public.studio_client_access, public.studio_ai_generations to service_role;

create or replace function public.studio_audit_state_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_operation uuid := nullif(current_setting('studio.operation_id', true), '')::uuid;
  v_actor text := coalesce(nullif(current_setting('studio.actor', true), ''), 'Studio');
  v_action text := coalesce(nullif(current_setting('studio.action', true), ''), 'Workspace updated');
  v_ids text[] := coalesce(string_to_array(nullif(current_setting('studio.record_ids', true), ''), ','), '{}'::text[]);
  v_item record;
begin
  insert into public.studio_audit_log(workspace_key, operation_id, actor, action, record_ids, before_data, after_data)
  values(new.workspace_key, v_operation, v_actor, v_action, v_ids, old.data, new.data);
  -- Also covers existing supplier-invoice RPC and legacy manual stock actions.
  if coalesce(current_setting('studio.explicit_transactions', true), '') <> 'true' then
    for v_item in
      select coalesce(n.item->>'id', o.item->>'id') as id,
        coalesce(n.item->>'name', o.item->>'name', 'Stock') as name,
        coalesce((n.item->>'stemsRemaining')::numeric, 0) - coalesce((o.item->>'stemsRemaining')::numeric, 0) as delta,
        coalesce((n.item->>'costPerStem')::numeric, (o.item->>'costPerStem')::numeric, 0) as cost,
        case when o.item is null and n.item->>'supplierInvoiceId' is not null then 'Receipt' else 'Adjustment' end as kind,
        coalesce(n.item->>'supplierInvoiceId', '') as source
      from jsonb_array_elements(coalesce(old.data->'inventory', '[]'::jsonb)) o(item)
      full join jsonb_array_elements(coalesce(new.data->'inventory', '[]'::jsonb)) n(item) on n.item->>'id' = o.item->>'id'
    loop
      if v_item.delta <> 0 then
        insert into public.studio_inventory_transactions(workspace_key, operation_id, inventory_id, item_name, quantity, unit_cost, kind, record_id, actor)
        values(new.workspace_key, v_operation, v_item.id, v_item.name, v_item.delta, v_item.cost, v_item.kind, v_item.source, v_actor);
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke execute on function public.studio_audit_state_change() from public, anon, authenticated;
grant execute on function public.studio_audit_state_change() to service_role;
drop trigger if exists studio_audit_state on public.studio_app_state;
create trigger studio_audit_state after update on public.studio_app_state for each row
when (old.data is distinct from new.data) execute function public.studio_audit_state_change();

create or replace function public.studio_commit_command(
  p_workspace text, p_operation_id uuid, p_payload_hash text, p_expected_updated_at timestamptz,
  p_data jsonb, p_action text, p_record_ids text[], p_transactions jsonb, p_actor text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_state public.studio_app_state%rowtype;
  v_receipt public.studio_command_receipts%rowtype;
  v_now timestamptz;
  v_tx jsonb;
begin
  if p_operation_id is null or p_payload_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Invalid Studio command.';
  end if;
  select * into v_state from public.studio_app_state where workspace_key = p_workspace for update;
  if not found then raise exception using errcode = '22023', message = 'Workspace not found.'; end if;
  select * into v_receipt from public.studio_command_receipts where workspace_key = p_workspace and operation_id = p_operation_id;
  if found then
    if v_receipt.payload_hash <> p_payload_hash then raise exception using errcode = '22023', message = 'Operation ID reused for a different action.'; end if;
    return jsonb_build_object('data', v_state.data, 'updatedAt', v_state.updated_at, 'alreadyApplied', true);
  end if;
  if p_expected_updated_at is distinct from v_state.updated_at then
    raise exception using errcode = '40001', message = 'The Studio changed. Refresh before saving.';
  end if;
  if jsonb_typeof(p_data->'inventory') is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(p_data->'inventory') i where jsonb_typeof(i->'stemsRemaining') is distinct from 'number'
      or (i->>'stemsRemaining')::numeric < 0
  ) then raise exception using errcode = '22023', message = 'Invalid inventory quantity.'; end if;
  perform set_config('studio.operation_id', p_operation_id::text, true);
  perform set_config('studio.actor', left(coalesce(p_actor, 'Studio'), 200), true);
  perform set_config('studio.action', left(coalesce(p_action, 'Studio updated'), 1000), true);
  perform set_config('studio.record_ids', array_to_string(p_record_ids, ','), true);
  perform set_config('studio.explicit_transactions', case when p_transactions is null then 'false' else 'true' end, true);
  v_now := greatest(clock_timestamp(), v_state.updated_at + interval '1 microsecond');
  update public.studio_app_state set data = p_data, updated_at = v_now where workspace_key = p_workspace;
  if p_transactions is not null then
    for v_tx in select value from jsonb_array_elements(p_transactions) loop
      insert into public.studio_inventory_transactions(workspace_key, operation_id, inventory_id, item_name, quantity, unit_cost, kind, record_id, actor)
      values(p_workspace, p_operation_id, v_tx->>'inventoryId', v_tx->>'name', (v_tx->>'quantity')::numeric,
        (v_tx->>'unitCost')::numeric, v_tx->>'kind', v_tx->>'recordId', p_actor);
    end loop;
  end if;
  insert into public.studio_command_receipts(workspace_key, operation_id, payload_hash, action)
  values(p_workspace, p_operation_id, p_payload_hash, p_action);
  return jsonb_build_object('data', p_data, 'updatedAt', v_now, 'alreadyApplied', false);
end;
$$;
revoke execute on function public.studio_commit_command(text, uuid, text, timestamptz, jsonb, text, text[], jsonb, text) from public, anon, authenticated;
grant execute on function public.studio_commit_command(text, uuid, text, timestamptz, jsonb, text, text[], jsonb, text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('studio-assets', 'studio-assets', false, 3145728, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
