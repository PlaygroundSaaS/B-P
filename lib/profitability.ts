import { calculateTotals, round2 } from './pricing';
import type { Quote } from './types';
export interface ProfitInput { flower: number; packaging: number; sundries: number; labour: number; waste: number; delivery: number; setup: number; collection: number; supplier: number; expenses: number; selling: number; vat: number; taxRate: number; }
export function profitModel(input: ProfitInput) {
  const cost = round2(input.flower + input.packaging + input.sundries + input.labour + input.waste + input.delivery + input.setup + input.collection + input.supplier + input.expenses);
  const profit = round2(input.selling - cost); const margin = input.selling > 0 ? round2(profit / input.selling * 100) : 0;
  const tax = round2(Math.max(0, profit) * Math.max(0, Math.min(100, input.taxRate)) / 100);
  const retained = round2(profit - tax); const gross = round2(input.selling + input.vat);
  const rating = profit < 0 ? 'Loss making' : margin >= 40 ? 'Excellent' : margin >= 30 ? 'Acceptable' : 'Low margin';
  return { ...input, cost, profit, margin, tax, retained, gross, rating, targetIncrease: round2(Math.max(0, cost / .6 - input.selling)), labourShare: input.selling ? round2(input.labour / input.selling * 100) : 0 };
}
export function recipeProfitInput(recipe: Quote, taxRate = 25): ProfitInput {
  const totals = calculateTotals(recipe); const quantity = recipe.quantity || 1;
  const packaging = round2(recipe.lines.filter(l => l.category === 'sundry' && l.costCategory === 'Packaging').reduce((s, l) => s + l.quantity * l.unitCost * quantity, 0));
  return { flower: totals.stemCost, packaging, sundries: round2(totals.sundryCost - packaging), labour: totals.labour, waste: totals.wastage,
    delivery: recipe.deliveryCost || 0, setup: recipe.setupCost || 0, collection: recipe.collectionCost || 0, supplier: recipe.supplierCharges || 0, expenses: recipe.additionalExpenses || 0,
    selling: totals.netTotal, vat: totals.vat, taxRate: recipe.corporationTaxRate ?? taxRate };
}
export const profitLabels = { flower: 'Flowers & foliage', packaging: 'Packaging', sundries: 'Sundries', labour: 'Labour', waste: 'Waste allowance', delivery: 'Delivery cost', setup: 'Installation / setup', collection: 'Collection cost', supplier: 'Supplier charges', expenses: 'Additional expenses' } as const;

export function eventProfitInput(data: import('./types').StudioData, quotes: import('./operations-types').EventQuote[]): ProfitInput {
  const result: ProfitInput = { flower: 0, packaging: 0, sundries: 0, labour: 0, waste: 0, delivery: 0, setup: 0, collection: 0, supplier: 0, expenses: 0, selling: 0, vat: 0, taxRate: data.settings.corporationTaxRate ?? 25 };
  const seen = new Set<string>();
  for (const q of quotes) {
    for (const id of q.recipeIds) { if (seen.has(id)) continue; seen.add(id); const recipe = data.jobs.find(r => r.id === id) || data.quotes.find(r => r.id === id); if (!recipe) continue; const input = recipeProfitInput(recipe); for (const key of Object.keys(profitLabels) as (keyof typeof profitLabels)[]) result[key] += input[key]; }
    result.selling += q.total - q.vat; result.vat += q.vat; result.setup += q.setupCost || 0; result.delivery += q.deliveryCost || 0; result.expenses += q.otherCost || 0;
  }
  return result;
}
