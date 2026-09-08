import { randomUUID } from 'node:crypto';
import { hasStudioSession } from '@/lib/studio-auth';
import { clientGrant } from '@/lib/client-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { boundedBody, imageMediaType } from '@/lib/supplier-invoice-server';
import { requireSameOrigin } from '@/lib/request-body';
import { readWorkspace, commandHash, commitWorkspace } from '@/lib/studio-command-server';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  const owner = await hasStudioSession(); const grant = owner ? null : await clientGrant();
  if (!owner && !grant) return json({ error: 'Please sign in to upload a file.' }, 401);
  try {
    requireSameOrigin(request);
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('multipart/form-data')) return json({ error: 'Choose a file.' }, 400);
    const raw = await boundedBody(request, 3 * 1024 * 1024 + 65536);
    const form = await new Response(raw, { headers: { 'Content-Type': type } }).formData(); const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024) return json({ error: 'Choose a JPEG, PNG, WebP or PDF under 3 MB.' }, 400);
    const bytes = Buffer.from(await file.arrayBuffer()); const pdf = bytes.toString('ascii', 0, 5) === '%PDF-';
    if (pdf && !owner) return json({ error: 'Please send documents directly to the studio. You can upload inspiration photographs here.' }, 400);
    const media = pdf ? 'application/pdf' : imageMediaType(bytes);
    const db = createStudioDatabaseClient(); if (!db) throw new Error('unavailable');
    const id = randomUUID(); const path = `${STUDIO_WORKSPACE}/${id}`;
    const { error } = await db.storage.from('studio-assets').upload(path, bytes, { contentType: media, upsert: false }); if (error) throw error;
    const asset = { id, name: file.name.replace(/[\x00-\x1f]/g, '').slice(0, 160), url: `/api/studio/assets/${id}`, type: media };
    if (grant) {
      const current = await readWorkspace(db); const plan = current.data.plans.find(p => p.id === grant.plan_id);
      if (!plan || (plan.references?.length || 0) >= 20) return json({ error: 'This plan cannot accept more images. Please contact the studio.' }, 400);
      plan.references = [...(plan.references || []), { id, name: asset.name, dataUrl: asset.url, caption: '' }];
      await commitWorkspace(db, { id: randomUUID(), hash: commandHash(asset), revision: current.updatedAt, data: current.data, action: 'Client added inspiration photo', recordIds: [plan.id], transactions: [], actor: `Client (${grant.id})` });
    }
    return json({ asset });
  } catch { return json({ error: 'The file could not be uploaded. Use a JPEG, PNG, WebP or PDF under 3 MB and try again.' }, 400); }
}
