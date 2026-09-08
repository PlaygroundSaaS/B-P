import type { StudioData, WeddingPlan } from './types';
import type { EventQuote } from './operations-types';
import { paidFor } from './studio-commands';
// Explicit allowlists: never serialize a Studio record wholesale to a client.
export function clientEvent(plan: WeddingPlan) {
  return { id: plan.id, clientName: plan.clientName, type: plan.type, eventDate: plan.eventDate, venue: plan.venue || '',
    palette: plan.palette || '', favouriteFlowers: plan.favouriteFlowers || '', avoidFlowers: plan.avoidFlowers || '',
    arrangements: plan.arrangements || '', notes: plan.notes || '', budget: plan.budget ?? null,
    inspiration: (plan.inspiration || []).map(i => ({ id: i.id, inspirationId: i.inspirationId, name: i.name, category: i.category, image: i.image, quantity: i.quantity, priceFrom: i.priceFrom, priceTo: i.priceTo, palette: i.palette, notes: i.notes, description: i.description })),
    requirements: (plan.requirements || []).map(r => ({ id: r.id, name: r.name, quantity: r.quantity, notes: r.notes })),
    references: (plan.references || []).map(r => ({ id: r.id, name: r.name, dataUrl: r.dataUrl, caption: r.caption })),
    setupOptions: plan.setupOptions || [], finishedEstimate: plan.finishedEstimate };
}
export function clientQuotation(data: StudioData, q: EventQuote) {
  const paid = paidFor(data, q.id);
  return { id: q.id, name: q.name, clientName: q.clientName, status: q.status, total: q.total, vat: q.vat,
    setup: q.setup, delivery: q.delivery, hire: q.hire || 0, discount: q.discount, setupGross: q.setup * (q.vatApplies ? 1 + q.vatRate / 100 : 1), deliveryGross: q.delivery * (q.vatApplies ? 1 + q.vatRate / 100 : 1), hireGross: (q.hire || 0) * (q.vatApplies ? 1 + q.vatRate / 100 : 1), discountGross: q.recipes.reduce((sum,r) => sum + r.total, 0) + (q.setup + q.delivery + (q.hire || 0)) * (q.vatApplies ? 1 + q.vatRate / 100 : 1) - q.total, terms: q.terms,
    recipes: q.recipes.map(r => ({ id: r.id, name: r.name, quantity: r.quantity, total: r.total })),
    paid, balance: Math.max(0, q.total - paid), paymentDue: q.paymentDue || '', depositDue: q.depositDue || 0,
    stages: q.stages || [], approval: q.approval ? { status: q.approval.status, comments: q.approval.comments, termsAccepted: q.approval.termsAccepted } : null };
}
export function clientAssetAllowed(data: StudioData, planId: string, url: string) {
  const plan = data.plans.find(p => p.id === planId);
  if (!plan) return false;
  return (plan.references || []).some(r => r.dataUrl === url) || (plan.setupOptions || []).some(o => o.photoSrc === url) ||
    (plan.inspiration || []).some(i => i.image === url) ||
    (data.operations?.catalogue || []).some(i => i.active && i.images.some(a => a.url === url));
}
