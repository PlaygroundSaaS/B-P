import { clientGrant } from '@/lib/client-auth';
import { createStudioDatabaseClient } from '@/lib/studio-database';
import { readWorkspace } from '@/lib/studio-command-server';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
  const grant = await clientGrant(); if (!grant) return json({ error: 'Please open your invitation.' }, 401);
  try {
    const { data } = await readWorkspace(createStudioDatabaseClient()!); const plan = data.plans.find(p => p.id === grant.plan_id);
    if (!plan) return json({ error: 'Plan not found.' }, 404);
    const params = new URL(request.url).searchParams; const search = (params.get('q') || '').toLowerCase();
    const offset = Math.max(0, Math.min(10000, Number(params.get('offset')) || 0));
    const items = (data.operations?.catalogue || []).filter(i => i.active && (i.occasion === plan.type || i.occasion === 'Other') && `${i.name} ${i.category} ${i.style} ${i.palette} ${i.season} ${i.flowers} ${i.tags}`.toLowerCase().includes(search));
    return json({ items: items.slice(offset, offset + 12), total: items.length, hasMore: items.length > offset + 12 });
  } catch { return json({ error: 'Inspiration could not be loaded.' }, 503); }
}
