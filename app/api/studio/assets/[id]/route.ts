import { hasStudioSession } from '@/lib/studio-auth';
import { clientGrant } from '@/lib/client-auth';
import { clientAssetAllowed } from '@/lib/client-portal';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readWorkspace } from '@/lib/studio-command-server';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response('Not found', { status: 404, headers });
  const owner = await hasStudioSession(); const grant = owner ? null : await clientGrant();
  if (!owner && !grant) return new Response('Please sign in', { status: 401, headers });
  const db = createStudioDatabaseClient(); if (!db) return new Response('Unavailable', { status: 503, headers });
  if (grant) {
    const state = await readWorkspace(db);
    if (!clientAssetAllowed(state.data, grant.plan_id, `/api/studio/assets/${id}`)) return new Response('Not found', { status: 404, headers });
  }
  const { data, error } = await db.storage.from('studio-assets').download(`${STUDIO_WORKSPACE}/${id}`);
  if (error || !data) return new Response('Not found', { status: 404, headers });
  return new Response(data, { headers: { ...headers, 'Content-Type': data.type, 'Content-Disposition': data.type === 'application/pdf' ? 'attachment; filename="studio-document.pdf"' : 'inline' } });
}
