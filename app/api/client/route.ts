import { randomUUID } from 'node:crypto';
import { clientGrant } from '@/lib/client-auth';
import { clientEvent, clientQuotation } from '@/lib/client-portal';
import { createStudioDatabaseClient } from '@/lib/studio-database';
import { readWorkspace, commitWorkspace, commandHash, priorCommand } from '@/lib/studio-command-server';
import { requireSameOrigin, readJsonObject, RequestError } from '@/lib/request-body';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  const grant = await clientGrant(); if (!grant) return json({ error: 'Open your invitation to see your floral plan.' }, 401);
  try {
    const { data, updatedAt } = await readWorkspace(createStudioDatabaseClient()!);
    const plan = data.plans.find(p => p.id === grant.plan_id); if (!plan) return json({ error: 'This plan is unavailable. Please contact the studio.' }, 404);
    return json({ plan: clientEvent(plan), quotes: (data.operations?.eventQuotes || []).filter(q => q.planId === plan.id).map(q => clientQuotation(data, q)), updatedAt });
  } catch { return json({ error: 'Your plan could not be loaded. Please try again.' }, 503); }
}
export async function POST(request: Request) {
  const grant = await clientGrant(); if (!grant) return json({ error: 'Please open your invitation again.' }, 401);
  try {
    requireSameOrigin(request); const body = await readJsonObject(request, 32000); const db = createStudioDatabaseClient()!;
    const current = await readWorkspace(db); const data = current.data; const plan = data.plans.find(p => p.id === grant.plan_id);
    if (!plan) throw new RequestError('Plan not found.', 404);
    if (body.expectedUpdatedAt !== current.updatedAt) throw new RequestError('Your plan was updated. Refresh it before saving.', 409);
    let action = '';
    if (body.action === 'inspiration') {
      const item = data.operations?.catalogue.find(i => i.id === body.inspirationId && i.active && (i.occasion === plan.type || i.occasion === 'Other'));
      if (!item || !Number.isInteger(body.quantity) || Number(body.quantity) < 1 || Number(body.quantity) > 1000) throw new RequestError('Choose a design and quantity.');
      plan.inspiration ||= [];
      const old = plan.inspiration.find(i => i.inspirationId === item.id);
      if (old) { old.quantity = Number(body.quantity); old.notes = String(body.notes || '').slice(0, 5000); }
      else plan.inspiration.push({ id: randomUUID(), inspirationId: item.id, name: item.name, category: item.category, image: item.images[0]?.url || '', description: item.description, quantity: Number(body.quantity), priceFrom: item.priceFrom, priceTo: item.priceTo, palette: item.palette, notes: String(body.notes || '').slice(0, 5000) });
      action = 'Client added inspiration';
    } else if (body.action === 'removeInspiration') {
      plan.inspiration = (plan.inspiration || []).filter(i => i.id !== body.selectionId); action = 'Client removed inspiration';
    } else if (body.action === 'notes') {
      plan.notes = String(body.notes || '').slice(0, 10000); plan.palette = String(body.palette || '').slice(0, 500); plan.favouriteFlowers = String(body.flowers || '').slice(0, 500); action = 'Client updated floral preferences';
    } else if (body.action === 'approval') {
      const quote = data.operations?.eventQuotes.find(q => q.id === body.quoteId && q.planId === plan.id && q.status === 'QUOTE');
      if (!quote || !['Approved', 'Changes requested'].includes(String(body.status))) throw new RequestError('Choose an open quote and response.');
      if (body.status === 'Approved' && body.termsAccepted !== true) throw new RequestError('Please accept the terms to approve this quote.');
      quote.approval = { status: body.status as 'Approved' | 'Changes requested', comments: String(body.comments || '').slice(0, 5000), termsAccepted: body.termsAccepted === true, recordedAt: new Date().toISOString(), recordedBy: 'Client' }; action = `Client quote response: ${body.status}`;
    } else throw new RequestError('This action is not available in your plan.');
    const result = await commitWorkspace(db, { id: randomUUID(), hash: commandHash({ grant: grant.id, body }), revision: current.updatedAt, data, action, recordIds: [plan.id, plan.customerId || ''], transactions: [], actor: `Client (${grant.id})` });
    // Re-project the response rather than exposing the internal command result.
    return json({ plan: clientEvent(plan), quotes: (data.operations?.eventQuotes || []).filter(q => q.planId === plan.id).map(q => clientQuotation(data, q)), updatedAt: result.updatedAt });
  } catch (e) { return json({ error: e instanceof RequestError ? e.message : 'Your change could not be saved. Please try again.' }, e instanceof RequestError ? e.status : 503); }
}
