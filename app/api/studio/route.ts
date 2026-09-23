import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { commandHash, commitWorkspace, readWorkspace } from '@/lib/studio-command-server';
import { stockSummary } from '@/lib/studio-commands';
import { emptyOperations } from '@/lib/operations-types';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { addsInlineImages, isStudioData } from '@/lib/studio-validation';
const json: typeof NextResponse.json = (body, init) => NextResponse.json(body, { ...init, headers: { ...init?.headers, 'Cache-Control': 'private, no-store' } });
import { blankData, reviveData } from '@/lib/studio-data';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE as WORKSPACE_KEY } from '@/lib/studio-database';

export const runtime = 'nodejs';


export async function GET() {
  if (!await hasStudioSession()) {
    return json({ error: 'Please sign in to open your Studio.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return json({ error: 'The Studio is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    }
    const { data, error } = await supabase
      .from('studio_app_state')
      .select('data, updated_at')
      .eq('workspace_key', WORKSPACE_KEY)
      .maybeSingle();
    if (error) throw error;
    return json({
      data: reviveData(data?.data ?? blankData()),
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error('[studio] database read failed', error);
    return json({ error: 'The Studio database could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await hasStudioSession()) {
    return json({ error: 'Please sign in to save changes.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return json({ error: 'The Studio is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    }
    requireSameOrigin(request);
    const body = await readJsonObject(request, 4 * 1024 * 1024);
    if (!isStudioData(body.data) || !('expectedUpdatedAt' in body) || (body.expectedUpdatedAt !== null && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))))) {
      throw new RequestError('The saved records are incomplete or contain invalid values. Check your entries and try again.');
    }
    const incoming = reviveData(body.data);
    const expectedUpdatedAt = body.expectedUpdatedAt as string | null;
    const current = await readWorkspace(supabase);
    if (addsInlineImages(current.data, incoming)) throw new RequestError('Upload photographs with the photo button so they are stored safely, then save again.');
    if (current.updatedAt !== expectedUpdatedAt) throw new RequestError('The Studio changed. Load the latest records before saving.', 409);
    const protectedKeys = ['eventQuotes', 'payments', 'hireReservations'] as const;
    const currentOps = { ...emptyOperations(), ...current.data.operations };
    const nextOps = { ...emptyOperations(), ...incoming.operations };
    if (JSON.stringify(current.data.jobs) !== JSON.stringify(incoming.jobs) || protectedKeys.some(key => JSON.stringify(currentOps[key]) !== JSON.stringify(nextOps[key]))) {
      throw new RequestError('Use the dedicated purchase, payment or hire action so the change is recorded safely.', 409);
    }
    for (const item of current.data.inventory) {
      if (!incoming.inventory.some(next => next.id === item.id) && stockSummary(current.data, item.id).reserved > 0) throw new RequestError('This stock is reserved for purchased work. Amend or cancel that recipe before removing it.');
    }
    for (const old of currentOps.purchaseOrders) {
      const next = nextOps.purchaseOrders.find(p => p.id === old.id);
      if (next?.status === 'Received' && old.status !== 'Received') throw new RequestError('Use Receive delivery to update inventory safely.');
      if (old.status === 'Received' && JSON.stringify(old) !== JSON.stringify(next)) throw new RequestError('Received purchase orders are preserved in the purchase history.');
    }
    for (const po of nextOps.purchaseOrders) if (po.status === 'Received' && !currentOps.purchaseOrders.some(p => p.id === po.id && p.status === 'Received')) throw new RequestError('Use Confirm received to record stock safely.');
    for (const h of currentOps.hireItems) {
      const reserved = currentOps.hireReservations.filter(r => r.itemId === h.id && r.status !== 'Returned');
      const next = nextOps.hireItems.find(i => i.id === h.id);
      if (reserved.length && (!next || next.quantity < Math.max(...reserved.map(r => currentOps.hireReservations.filter(b => b.itemId === h.id && b.status !== 'Returned' && b.from <= r.from && b.to >= r.from).reduce((sum,b) => sum + b.quantity, 0))))) throw new RequestError('This change would remove hire items already reserved for events. Record returns first.');
    }
    for (const p of current.data.plans) if (!incoming.plans.some(next => next.id === p.id) && (current.data.jobs.some(j => j.planId === p.id) || currentOps.eventQuotes.some(q => q.planId === p.id))) throw new RequestError('This event has quotation or purchase history and must be kept.');
    const recordIds: string[] = [];
    for (const key of ['inventory', 'wastage', 'customers', 'quotes', 'plans', 'weddingBuilds', 'materials'] as const) {
      for (const row of [...incoming[key], ...current.data[key]]) {
        const before = current.data[key].find(r => r.id === row.id);
        const after = incoming[key].find(r => r.id === row.id);
        if (JSON.stringify(before) !== JSON.stringify(after)) recordIds.push(row.id);
      }
    }
    for (const key of Object.keys(nextOps) as (keyof typeof nextOps)[]) {
      for (const row of nextOps[key]) if (JSON.stringify(row) !== JSON.stringify(currentOps[key].find(r => r.id === row.id))) recordIds.push(row.id);
    }
    const id = typeof body.operationId === 'string' && /^[a-f0-9-]{36}$/i.test(body.operationId) ? body.operationId : randomUUID();
    return json(await commitWorkspace(supabase, { id, hash: commandHash(incoming), revision: current.updatedAt, data: incoming, action: 'Studio records updated', recordIds: [...new Set(recordIds)] }));
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, { status: error.status });
    console.error('[studio] database save failed', error);
    return json({ error: 'Your change could not be saved to the Studio database.' }, { status: 503 });
  }
}

