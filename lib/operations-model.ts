import { calculateTotals, DEFAULT_SETTINGS, round2 } from './pricing';
import { recipeRequirements, paidFor } from './studio-commands';
import type { StudioData, Quote, WeddingPlan } from './types';
import type { InspirationSelection, EventRequirement } from './operations-types';
export const newId = () => globalThis.crypto.randomUUID();
export const day = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const addDays = (date: string, amount: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); };
export function newRecipe(data: StudioData, plan?: WeddingPlan, selection?: InspirationSelection | EventRequirement): Quote {
  return { id: newId(), name: selection?.name || '', status: 'DRAFT', quantity: selection?.quantity || 1, clientName: plan?.clientName || '', customerId: plan?.customerId,
    planId: plan?.id, occasion: plan?.type || 'Bouquet', eventDate: plan?.eventDate || '', contact: plan?.contact || '',
    inspirationId: selection?.id, inspirationImage: selection && 'image' in selection ? selection.image : '', palette: plan?.palette || '',
    estimatedBudget: selection && 'priceFrom' in selection ? `${selection.priceFrom}–${selection.priceTo} each` : '',
    lines: [], labourHours: 0, labourRate: data.settings.labourRate, wastagePercent: data.settings.defaultWastage, markupPercent: data.settings.defaultMarkup,
    deliveryFee: 0, discount: 0, vatApplies: true, vatRate: data.settings.vatRate, notes: selection?.notes || '', instructions: '', createdAt: new Date().toISOString() };
}
export function duplicateRecipe(recipe: Quote, template = false): Quote {
  const result = structuredClone(recipe);
  Object.assign(result, { id: newId(), name: `${recipe.name || recipe.occasion}${template ? ' template' : ' — copy'}`, status: 'DRAFT', createdAt: new Date().toISOString(), updatedAt: undefined, isTemplate: template, commitments: undefined, consumedAt: undefined, cancelledAt: undefined, productionStatus: undefined });
  for (const field of ['wonAt', 'totals', 'stockReturned']) delete (result as unknown as Record<string, unknown>)[field];
  if (template) { result.clientName = ''; result.customerId = undefined; result.planId = undefined; result.eventDate = ''; result.contact = ''; result.inspirationId = undefined; }
  result.lines = result.lines.map(l => ({ ...l, id: newId() })); return result;
}
export function estimateTotal(plan: WeddingPlan) {
  return (plan.inspiration || []).reduce((s, i) => ({ from: round2(s.from + i.priceFrom * i.quantity), to: round2(s.to + i.priceTo * i.quantity) }), { from: 0, to: 0 });
}
export function stockForecast(data: StudioData, from = day(), to = addDays(from, 7)) {
  const rows = new Map<string, { inventoryId: string; name: string; supplier: string; required: number; committed: number; available: number; shortfall: number; surplus: number; unitCost: number }>();
  for (const job of data.jobs.filter(j => !j.stockReturned && !j.consumedAt && (!j.eventDate || j.eventDate >= from && j.eventDate <= to))) {
    for (const need of recipeRequirements(job)) {
      const stock = data.inventory.find(i => i.id === need.inventoryId);
      const row = rows.get(need.inventoryId) || { inventoryId: need.inventoryId, name: need.name, supplier: stock?.supplier || 'Unassigned supplier', required: 0, committed: 0, available: stock?.stemsRemaining || 0, shortfall: 0, surplus: 0, unitCost: stock?.costPerStem || need.unitCost };
      row.required += need.quantity; row.committed += (job.commitments || []).filter(c => c.inventoryId === need.inventoryId).reduce((s, c) => s + c.quantity, 0); rows.set(need.inventoryId, row);
    }
  }
  return [...rows.values()].map(r => ({ ...r, shortfall: round2(Math.max(0, r.required - r.committed - r.available)), surplus: round2(Math.max(0, r.available + r.committed - r.required)) }));
}
export function financialOrders(data: StudioData) {
  const groups = data.operations?.eventQuotes || [];
  const groupIds = new Set(groups.filter(q => q.status === 'PURCHASED').flatMap(q => q.recipeIds));
  const rows = [
    ...groups.map(q => { const recipes = q.recipeIds.map(id => data.jobs.find(j => j.id === id) || data.quotes.find(j => j.id === id)).filter((r): r is Quote => !!r); const costs = recipes.reduce((s, r) => s + calculateTotals(r).costSubtotal, 0) + (q.setupCost || 0) + (q.deliveryCost || 0) + (q.otherCost || 0); return { id: q.id, planId: q.planId, clientName: q.clientName, name: q.name, date: q.purchasedAt || q.createdAt, total: q.total, vat: q.vat, cost: costs, profit: round2(q.total - q.vat - costs), purchased: q.status === 'PURCHASED', due: q.paymentDue || '', deposit: q.depositDue || 0, stages: q.stages || [], invoiced: !!q.invoicedAt, occasion: data.plans.find(p => p.id === q.planId)?.type || 'Other' }; }),
    ...data.jobs.filter(j => !j.stockReturned && !groupIds.has(j.id)).map(j => ({ id: j.id, planId: j.planId || '', clientName: j.clientName, name: j.name || j.occasion, date: j.wonAt, total: j.totals.grossTotal, vat: j.totals.vat, cost: j.totals.costSubtotal, profit: j.totals.profit, purchased: true, due: j.paymentDue || '', deposit: j.depositDue || 0, stages: [], invoiced: !!j.invoicedAt, occasion: j.occasion })),
  ];
  return rows.map(r => { const paid = paidFor(data, r.id); const balance = round2(Math.max(0, r.total - paid)); const refunds = (data.operations?.payments || []).some(p => p.orderId === r.id && p.kind === 'Refund'); return { ...r, paid, balance, status: refunds && paid <= .001 ? 'Refunded' : balance <= .001 ? 'Paid' : r.due && r.due < day() ? 'Overdue' : paid > 0 ? (r.deposit > 0 && paid >= r.deposit ? 'Deposit paid' : 'Partially paid') : refunds ? 'Refunded' : r.deposit > 0 ? 'Deposit due' : r.invoiced ? 'Invoiced' : 'Not invoiced' }; });
}
export interface CalendarItem { id: string; date: string; time: string; title: string; kind: string; tab: string; recordId: string; }
export function calendarItems(data: StudioData): CalendarItem[] {
  const items: CalendarItem[] = [];
  const add = (id: string, date: string, time: string, title: string, kind: string, tab: string, recordId: string) => { if (date) items.push({ id, date, time, title, kind, tab, recordId }); };
  for (const p of data.plans) { add(p.id, p.eventDate, p.serviceTime || p.details?.ceremonyTime || '', p.clientName, p.type, 'clients', p.id); add(`consult-${p.id}`, p.details?.consultationDate || '', p.details?.consultationTime || '', p.clientName, 'Consultation', 'clients', p.id); }
  for (const l of data.operations?.leads || []) if (!l.planId) add(`lead-${l.id}`, l.consultationDate, l.consultationTime, l.clientName, 'Consultation', 'leads', l.id);
  for (const d of data.operations?.deliveries || []) { add(d.id, d.date, d.window, d.clientName, 'Delivery', 'deliveries', d.id); add(`collect-${d.id}`, d.collectionDate, d.collectionTime, d.clientName, 'Collection', 'deliveries', d.id); }
  for (const p of data.operations?.purchaseOrders || []) if (p.status !== 'Received') add(p.id, p.expectedDelivery, '', p.supplierName, 'Supplier delivery', 'suppliers', p.id);
  for (const j of data.jobs.filter(j => !j.stockReturned && j.productionStatus !== 'Delivered')) add(j.id, j.productionDue || j.eventDate, '', `${j.clientName} · ${j.name || j.occasion}`, 'Production', 'production', j.id);
  for (const o of financialOrders(data).filter(o => o.balance > 0)) { add(`pay-${o.id}`, o.due, '', o.clientName, 'Payment due', 'payments', o.id); for (const s of o.stages) add(s.id, s.due, '', `${o.clientName} · ${s.name}`, 'Payment stage', 'payments', o.id); }
  for (const c of data.operations?.crm || []) if (c.dueDate && !c.completed) add(c.id, c.dueDate, '', data.customers.find(row => row.id === c.customerId)?.name || 'Client follow-up', 'Follow-up', 'clients', c.customerId);
  for (const t of data.operations?.tasks || []) if (!t.completed) add(t.id, t.due, '', t.title, 'Task', 'tasks', t.id);
  for (const r of data.operations?.recurring || []) if (r.status === 'Active') add(r.id, r.nextDate, '', r.clientName, 'Recurring flowers', 'recurring', r.id);
  return items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
export function actionItems(data: StudioData) {
  const today = day(); const items: { id: string; title: string; detail: string; tab: string; recordId: string }[] = [];
  for (const l of data.operations?.leads || []) if (!['Won', 'Lost'].includes(l.status) && (!l.followUpDate || l.followUpDate <= today)) items.push({ id: `lead-${l.id}-${l.followUpDate}`, title: `Follow up ${l.clientName}`, detail: l.status, tab: 'leads', recordId: l.id });
  for (const q of data.operations?.eventQuotes || []) if (q.status === 'QUOTE') items.push({ id: `quote-${q.id}-${q.updatedAt}`, title: `${q.clientName}: quotation awaiting purchase`, detail: q.approval?.status || 'Awaiting response', tab: 'payments', recordId: q.id });
  for (const o of financialOrders(data)) if (o.status === 'Overdue') items.push({ id: `pay-${o.id}-${o.due}`, title: `${o.clientName}: payment overdue`, detail: `Balance £${o.balance.toFixed(2)}`, tab: 'payments', recordId: o.id });
  for (const s of stockForecast(data)) if (s.shortfall) items.push({ id: `stock-${s.inventoryId}-${today}`, title: `${s.name}: ${s.shortfall} short`, detail: 'Purchased work in the next 7 days', tab: 'suppliers', recordId: s.inventoryId });
  for (const h of data.operations?.hireReservations || []) if (h.status !== 'Returned' && h.to <= today) items.push({ id: `hire-${h.id}-${h.to}`, title: `${h.clientName}: hire collection due`, detail: `${h.quantity} items · ${h.to}`, tab: 'hire', recordId: h.id });
  for (const c of data.customers) if (c.anniversary) { const anniversary = `${today.slice(0, 4)}-${c.anniversary.slice(5)}`; if (anniversary >= today && anniversary <= addDays(today, 14)) items.push({ id: `anniversary-${c.id}-${anniversary}`, title: `${c.name}: anniversary coming up`, detail: `${anniversary} · draft a personal follow-up`, tab: 'clients', recordId: c.id }); }
  for (const c of data.operations?.crm || []) if (c.dueDate && c.dueDate <= today && !c.completed) items.push({ id: `crm-${c.id}`, title: `Follow up ${data.customers.find(row => row.id === c.customerId)?.name || 'client'}`, detail: c.text.slice(0, 100), tab: 'clients', recordId: c.customerId });
  return items.filter(i => !(data.operations?.dismissedActions || []).some(d => d.id === i.id && d.until >= today));
}
