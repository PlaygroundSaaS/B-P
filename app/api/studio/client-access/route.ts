import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readWorkspace } from '@/lib/studio-command-server';
import { readJsonObject, requireSameOrigin } from '@/lib/request-body';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in.' }, 401);
  try {
    requireSameOrigin(request); const body = await readJsonObject(request, 4096);
    const db = createStudioDatabaseClient(); if (!db) return json({ error: 'The Studio is unavailable.' }, 503);
    if (body.revokeId) {
      const { error } = await db.from('studio_client_access').update({ revoked_at: new Date().toISOString() }).eq('id', String(body.revokeId)).eq('workspace_key', STUDIO_WORKSPACE);
      if (error) throw error; return json({ revoked: true });
    }
    const { data } = await readWorkspace(db); const plan = data.plans.find(p => p.id === body.planId);
    if (!plan) return json({ error: 'Save this event first.' }, 400);
    const id = randomUUID(); const secret = randomBytes(32).toString('base64url');
    const { error } = await db.from('studio_client_access').insert({ id, workspace_key: STUDIO_WORKSPACE, plan_id: plan.id, client_id: plan.customerId || plan.id, token_hash: createHash('sha256').update(secret).digest('hex') });
    if (error) throw error;
    return json({ id, invite: `${id}.${secret}` });
  } catch { return json({ error: 'The client invitation could not be created. Please try again.' }, 503); }
}
export async function GET(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in.' }, 401);
  const db = createStudioDatabaseClient(); if (!db) return json({ error: 'Unavailable.' }, 503);
  const planId = new URL(request.url).searchParams.get('planId');
  const { data, error } = await db.from('studio_client_access').select('id,plan_id,created_at,expires_at,revoked_at').eq('workspace_key', STUDIO_WORKSPACE).eq('plan_id', planId || '').order('created_at', { ascending: false }).limit(20);
  return error ? json({ error: 'Invitations could not be loaded.' }, 503) : json({ invitations: data });
}
