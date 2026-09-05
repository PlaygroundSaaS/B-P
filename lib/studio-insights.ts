import { round2 } from './pricing';
import type { StudioData } from './types';

const localDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
};
export function studioInsights(data: StudioData, from = '', to = '') {
  const within = (date: string) => !!date && (!from || date >= from) && (!to || date <= to);
  const flowers = new Map<string, { name: string; unit: string; sold: number; cost: number; revenue: number; contribution: number; wasted: number; wasteCost: number }>();
  const months = new Map<string, { month: string; waste: number; contribution: number }>();
  const getMonth = (date: string) => { const key = date.slice(0, 7); if (!months.has(key)) months.set(key, { month: key, waste: 0, contribution: 0 }); return months.get(key)!; };
  const getFlower = (name: string, unit: string) => {
    const key = `${name.trim().toLocaleLowerCase('en-GB')}|${unit}`;
    if (!flowers.has(key)) flowers.set(key, { name: name.trim(), unit, sold: 0, cost: 0, revenue: 0, contribution: 0, wasted: 0, wasteCost: 0 });
    return flowers.get(key)!;
  };
  let jobCount = 0, returnedJobs = 0, unallocatedJobs = 0;
  for (const job of data.jobs) {
    const date = localDate(job.wonAt);
    if (!within(date)) continue;
    if (job.stockReturned) { returnedJobs++; continue; }
    jobCount++;
    const lineCost = job.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    if (!lineCost) unallocatedJobs++;
    for (const line of job.lines.filter(item => item.category === 'stem')) {
      const inventory = data.inventory.find(item => item.id === line.inventoryId);
      const row = getFlower(line.name, line.stockUnit || inventory?.stockUnit || 'stem');
      const cost = line.quantity * line.unitCost;
      const share = lineCost > 0 ? cost / lineCost : 0;
      row.sold += line.quantity; row.cost += cost; row.revenue += job.totals.netTotal * share;
      row.contribution += job.totals.profit * share;
      getMonth(date).contribution += job.totals.profit * share;
    }
  }
  let wasteCost = 0, wasted = 0;
  for (const waste of data.wastage) {
    const date = localDate(waste.recordedAt);
    if (!within(date)) continue;
    const inventory = data.inventory.find(item => item.id === waste.inventoryId);
    const row = getFlower(waste.name, waste.stockUnit || inventory?.stockUnit || 'stem');
    const cost = waste.quantity * waste.unitCost;
    row.wasted += waste.quantity; row.wasteCost += cost;
    wasteCost += cost; wasted += waste.quantity; getMonth(date).waste += cost;
  }
  const rows = [...flowers.values()].map(row => ({ ...row, cost: round2(row.cost), revenue: round2(row.revenue), contribution: round2(row.contribution), wasteCost: round2(row.wasteCost), profit: round2(row.contribution - row.wasteCost) })).sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
  const trend = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  return { rows, trend, jobCount, returnedJobs, unallocatedJobs, wasted, wasteCost: round2(wasteCost), usedCost: round2(rows.reduce((sum, row) => sum + row.cost, 0)), profit: round2(rows.reduce((sum, row) => sum + row.profit, 0)) };
}
