import { randomUUID } from 'node:crypto';
import { hasStudioSession } from '@/lib/studio-auth';
import { clientGrant } from '@/lib/client-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { boundedBody, imageMediaType, InvoiceError } from '@/lib/supplier-invoice-server';
import { requireSameOrigin, RequestError } from '@/lib/request-body';
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
    // Check a client's photo allowance before anything is stored, so refused uploads never use storage.
    const tooMany = 'This plan cannot accept more images. Please contact the studio.';
    const planFor = (data: Awaited<ReturnType<typeof readWorkspace>>['data']) => grant ? data.plans.find(p => p.id === grant.plan_id) : undefined;
    if (grant) {
      const plan = planFor((await readWorkspace(db)).data);
      if (!plan || (plan.references?.length || 0) >= 20) return json({ error: tooMany }, 400);
    }
    const id = randomUUID(); const path = `${STUDIO_WORKSPACE}/${id}`;
    const { error } = await db.storage.from('studio-assets').upload(path, bytes, { contentType: media, upsert: false }); if (error) throw error;
    const asset = { id, name: file.name.replace(/[\x00-\x1f]/g, '').slice(0, 160), url: `/api/studio/assets/${id}`, type: media };
    if (grant) {
      try {
        for (let attempt = 0; ; attempt++) {
          const current = await readWorkspace(db); const plan = planFor(current.data);
          if (!plan || (plan.references?.length || 0) >= 20) throw new RequestError(tooMany);
          plan.references = [...(plan.references || []), { id, name: asset.name, dataUrl: asset.url, caption: '' }];
          try {
            await commitWorkspace(db, { id: randomUUID(), hash: commandHash(asset), revision: current.updatedAt, data: current.data, action: 'Client added inspiration photo', recordIds: [plan.id], transactions: [], actor: `Client (${grant.id})` });
            break;
          } catch (error) {
            // The Studio saved at the same moment: reload and try again rather than failing the client.
            if (!(error instanceof RequestError && error.status === 409) || attempt >= 2) throw error;
          }
        }
      } catch (error) {
        await db.storage.from('studio-assets').remove([path]);
        throw error;
      }
    }
    return json({ asset });
  } catch (error) {
    if (error instanceof RequestError || error instanceof InvoiceError) return json({ error: error.message }, error.status);
    return json({ error: 'The file could not be uploaded. Use a JPEG, PNG, WebP or PDF under 3 MB and try again.' }, 400);
  }
}
