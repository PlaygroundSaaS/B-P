import type { Quote, QuoteTotals, Settings, StudioData } from './types';

export const DEFAULT_SETTINGS: Settings = { defaultMarkup: 250, defaultWastage: 10, labourRate: 25, vatRate: 20 };
export const emptyStudio = (): StudioData => ({ version: 1, inventory: [], quotes: [], jobs: [], plans: [], settings: DEFAULT_SETTINGS });
export const num = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace('£', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num(value));
export function calculateTotals(quote: Quote): QuoteTotals {
  const stemCost = round2(quote.lines.filter(line => line.category === 'stem').reduce((sum, line) => sum + num(line.quantity) * num(line.unitCost), 0));
  const sundryCost = round2(quote.lines.filter(line => line.category === 'sundry').reduce((sum, line) => sum + num(line.quantity) * num(line.unitCost), 0));
  const materialCost = round2(stemCost + sundryCost);
  const wastage = round2(stemCost * num(quote.wastagePercent) / 100);
  const labour = round2(num(quote.labourHours) * num(quote.labourRate));
  const costSubtotal = round2(materialCost + wastage + labour);
  const markup = round2(costSubtotal * num(quote.markupPercent) / 100);
  const netTotal = round2(Math.max(0, costSubtotal + markup + num(quote.deliveryFee) - num(quote.discount)));
  const vat = quote.vatApplies ? round2(netTotal * num(quote.vatRate) / 100) : 0;
  const grossTotal = round2(netTotal + vat);
  const profit = round2(netTotal - costSubtotal);
  return { stemCost, sundryCost, materialCost, wastage, labour, costSubtotal, markup, netTotal, vat, grossTotal, profit, marginPercent: netTotal ? round2(profit / netTotal * 100) : 0 };
}

