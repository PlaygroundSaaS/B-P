import { calculateTotals, round2 } from './pricing';
import type { Quote, StudioData, WeddingBuild } from './types';

export function validateQuote(quote: Quote): string | null {
  if (!quote.clientName.trim()) return 'Add the client name before saving.';
  if (!quote.lines.length) return 'Add at least one flower or material.';
  if (quote.lines.some(line => !line.name.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || (line.category === 'stem' && !Number.isInteger(line.quantity)) || !Number.isFinite(line.unitCost) || line.unitCost < 0)) return 'Every line needs a name, a positive quantity and a valid cost. Flower quantities must be whole numbers.';
  if ([quote.labourHours, quote.labourRate, quote.wastagePercent, quote.markupPercent, quote.deliveryFee, quote.discount, quote.vatRate].some(value => !Number.isFinite(value) || value < 0)) return 'Pricing values must be zero or more.';
  return null;
}

export function saveQuoteToData(data: StudioData, quote: Quote): StudioData {
  const error = validateQuote(quote);
  if (error) throw new Error(error);
  if (data.jobs.some(job => job.id === quote.id)) throw new Error('This quote is already a won job. Start a new quote.');
  const saved = { ...quote, clientName: quote.clientName.trim(), lines: quote.lines.map(line => ({ ...line })) };
  return { ...data, quotes: [saved, ...data.quotes.filter(item => item.id !== quote.id)] };
}

export function winQuote(data: StudioData, quote: Quote, wonAt = new Date().toISOString()): StudioData {
  saveQuoteToData(data, quote);
  const required = new Map<string, number>();
  for (const line of quote.lines.filter(item => item.category === 'stem')) {
    if (!line.inventoryId || !data.inventory.some(item => item.id === line.inventoryId)) throw new Error(`${line.name} is no longer in inventory. Choose an available flower.`);
    required.set(line.inventoryId, (required.get(line.inventoryId) || 0) + line.quantity);
  }
  for (const [id, quantity] of required) {
    const item = data.inventory.find(stock => stock.id === id)!;
    if (quantity > item.stemsRemaining) throw new Error(`${item.name}: this job needs ${quantity}, but only ${item.stemsRemaining} are available. Reduce the quantity or add stock first.`);
  }
  return {
    ...data,
    inventory: data.inventory.map(item => ({ ...item, stemsRemaining: item.stemsRemaining - (required.get(item.id) || 0) })),
    quotes: data.quotes.filter(item => item.id !== quote.id),
    jobs: [{ ...quote, clientName: quote.clientName.trim(), lines: quote.lines.map(line => ({ ...line })), wonAt, stockReturned: false, totals: calculateTotals(quote) }, ...data.jobs],
  };
}

// The builder and invoice both price the whole purchase, including planned surplus.
export function weddingTotals(build: WeddingBuild) {
  const flowerCost = round2(build.inventory.reduce((sum, flower) => sum + flower.stemsPerPurchase * flower.purchases * flower.costPerStem, 0));
  const materialCost = round2(build.materials.reduce((sum, material) => sum + material.quantity * material.unitCost, 0));
  const baseCost = round2(flowerCost + materialCost);
  const markup = round2(baseCost * build.markupPercent / 100);
  const net = round2(baseCost + markup);
  const vat = round2(net * build.vatRate / 100);
  return { flowerCost, materialCost, baseCost, markup, net, netProfit: markup, vat, total: round2(net + vat) };
}
