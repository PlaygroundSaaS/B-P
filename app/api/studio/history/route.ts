import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in.' }, 401);
  const db = createStudioDatabaseClient(); if (!db) return json({ error: 'History is unavailable.' }, 503);
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
  const transactions = params.get('kind') === 'stock';
  let query = transactions ? db.from('studio_inventory_transactions').select('id,inventory_id,item_name,quantity,unit_cost,kind,record_id,actor,created_at') : db.from('studio_audit_log').select('id,actor,action,record_ids,created_at');
  query = query.eq('workspace_key', STUDIO_WORKSPACE);
  if (params.get('recordId')) query = transactions ? query.eq('inventory_id', params.get('recordId')!) : query.contains('record_ids', [params.get('recordId')!]);
  const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 49);
  return error ? json({ error: 'History could not be loaded.' }, 503) : json({ rows: data, nextOffset: offset + 50, hasMore: data.length === 50 });
}
