import type { StudioData } from './types';
import { financialOrders } from './operations-model';
import { round2 } from './pricing';
export function businessIntelligence(data: StudioData, from = '', to = '9999') {
  const rows = financialOrders(data).filter(o => o.purchased && o.date.slice(0, 10) >= from && o.date.slice(0, 10) <= to);
  const waste = data.wastage.filter(w => w.recordedAt.slice(0, 10) >= from && w.recordedAt.slice(0, 10) <= to).reduce((s, w) => s + w.quantity * w.unitCost, 0);
  const revenue = round2(rows.reduce((s, o) => s + o.total - o.vat, 0));
  const gross = round2(rows.reduce((s, o) => s + o.profit, 0));
  const profit = round2(gross - waste);
  const tax = round2(Math.max(0, profit) * (data.settings.corporationTaxRate ?? 25) / 100);
  const aggregate = (key: (row: typeof rows[number]) => string) => {
    const values = new Map<string, { name: string; revenue: number; profit: number; count: number }>();
    rows.forEach(row => { const name = key(row); const value = values.get(name) || { name, revenue: 0, profit: 0, count: 0 }; value.revenue += row.total - row.vat; value.profit += row.profit; value.count++; values.set(name, value); });
    return [...values.values()].map(v => ({ ...v, revenue: round2(v.revenue), profit: round2(v.profit) })).sort((a, b) => b.profit - a.profit);
  };
  const monthly = aggregate(o => o.date.slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name));
  return { rows, revenue, gross, waste: round2(waste), profit, tax, net: round2(profit - tax), vat: round2(rows.reduce((s, o) => s + o.vat, 0)), paid: round2(rows.reduce((s, o) => s + o.paid, 0)), margin: revenue ? round2(gross / revenue * 100) : 0, customers: aggregate(o => o.clientName), products: aggregate(o => o.name), categories: aggregate(o => o.occasion), monthly,
    weddings: rows.filter(o => o.occasion === 'Wedding').sort((a, b) => b.profit - a.profit), lowest: [...rows].sort((a, b) => (a.total - a.vat ? a.profit / (a.total - a.vat) : -Infinity) - (b.total - b.vat ? b.profit / (b.total - b.vat) : -Infinity)) };
}
