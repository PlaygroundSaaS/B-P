import type { StudioData } from './types';
import { emptyOperations } from './operations-types';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9;
const string = (v: unknown) => typeof v === 'string' && v.length <= 20_000;
export const safeAssetUrl = (v: unknown): v is string => typeof v === 'string' && (v === '' || /^\/api\/studio\/assets\/[a-f0-9-]{36}$/.test(v) || /^\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(v) || (v.length <= 1_500_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)));
const assets = (v: unknown) => Array.isArray(v) && v.length <= 20 && v.every(a => object(a) && string(a.id) && string(a.name) && string(a.type) && safeAssetUrl(a.url));
// Reject malformed optional data before either command or legacy full-state writes.
export function validOperations(data: StudioData): boolean {
  for (const rows of [data.inventory, data.quotes, data.jobs, data.plans, data.customers, data.materials, data.wastage, data.weddingBuilds]) {
    if (new Set(rows.map(r => r.id)).size !== rows.length) return false;
  }
  if (![...data.quotes, ...data.jobs].every(r => (r.quantity === undefined || (amount(r.quantity) && r.quantity > 0 && Number.isInteger(r.quantity))) && (r.status === undefined || ['DRAFT', 'QUOTE', 'PURCHASED'].includes(r.status)) && (r.inspirationImage === undefined || safeAssetUrl(r.inspirationImage)) && (!r.commitments || (Array.isArray(r.commitments) && r.commitments.every(c => object(c) && string(c.inventoryId) && amount(c.quantity)))))) return false;
  for (const p of data.plans) {
    if (p.details && (!object(p.details) || (p.details.documents && !assets(p.details.documents)))) return false;
    if (p.inspiration && (!Array.isArray(p.inspiration) || !p.inspiration.every(i => object(i) && string(i.id) && string(i.name) && amount(i.quantity) && i.quantity > 0 && Number.isInteger(i.quantity) && amount(i.priceFrom) && amount(i.priceTo) && i.priceTo >= i.priceFrom && safeAssetUrl(i.image)))) return false;
    if (p.requirements && (!Array.isArray(p.requirements) || !p.requirements.every(i => object(i) && string(i.id) && string(i.name) && amount(i.quantity) && i.quantity > 0))) return false;
  }
  if (data.settings.corporationTaxRate !== undefined && (!amount(data.settings.corporationTaxRate) || data.settings.corporationTaxRate > 100)) return false;
  for (const r of [...data.quotes, ...data.jobs]) {
    if (![r.sellingPriceExVat, r.deliveryCost, r.setupCost, r.collectionCost, r.supplierCharges, r.additionalExpenses, r.corporationTaxRate].every(v => v === undefined || amount(v))) return false;
    if (r.vatRate > 100 || (r.corporationTaxRate ?? 0) > 100 || !r.lines.every(l => ['stem', 'sundry'].includes(l.category))) return false;
  }
  if (!data.operations) return true;
  const ops = data.operations;
  if (!object(ops)) return false;
  for (const key of Object.keys(emptyOperations()) as (keyof typeof ops)[]) {
    const rows = ops[key];
    if (!Array.isArray(rows) || rows.length > 10000 || rows.some(r => !object(r) || !string(r.id) || !r.id) || new Set(rows.map(r => r.id)).size !== rows.length) return false;
  }
  if (!ops.catalogue.every(i => string(i.name) && typeof i.active === 'boolean' && amount(i.priceFrom) && amount(i.priceTo) && i.priceTo >= i.priceFrom && assets(i.images))) return false;
  if (!ops.hireItems.every(i => string(i.name) && amount(i.quantity) && Number.isInteger(i.quantity) && amount(i.replacementCost))) return false;
  if (!ops.hireReservations.every(i => string(i.itemId) && amount(i.quantity) && ['Reserved', 'Out', 'Returned'].includes(i.status))) return false;
  if (!ops.suppliers.every(i => string(i.name) && amount(i.minimumOrder))) return false;
  if (!ops.purchaseOrders.every(p => string(p.supplierName) && ['Draft', 'Ordered', 'Received'].includes(p.status) && Array.isArray(p.lines) && p.lines.every(l => object(l) && string(l.name) && amount(l.quantity) && l.quantity > 0 && amount(l.unitCost)))) return false;
  if (!ops.eventQuotes.every(q => string(q.clientName) && Array.isArray(q.recipeIds) && Array.isArray(q.recipes) && ['QUOTE', 'PURCHASED'].includes(q.status) && [q.total, q.vat, q.setup, q.delivery, q.discount].every(amount))) return false;
  if (!ops.payments.every(p => string(p.orderId) && amount(p.amount) && p.amount > 0 && ['Deposit', 'Balance', 'Refund'].includes(p.kind))) return false;
  if (!ops.deliveries.every(d => string(d.clientName) && string(d.date) && Array.isArray(d.checklist) && d.checklist.every(c => object(c) && string(c.text) && typeof c.done === 'boolean'))) return false;
  if (!ops.leads.every(l => string(l.clientName) && string(l.status) && string(l.contact))) return false;
  if (!ops.crm.every(c => string(c.customerId) && string(c.text) && assets(c.assets))) return false;
  if (!ops.tasks.every(t => string(t.title) && typeof t.completed === 'boolean')) return false;
  if (!ops.recurring.every(r => string(r.clientName) && amount(r.price) && ['Active', 'Paused', 'Cancelled'].includes(r.status))) return false;
  return true;
}
