import type { StudioData } from './types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const collections = ['inventory', 'wastage', 'materials', 'customers', 'quotes', 'jobs', 'plans', 'weddingBuilds'] as const;

/** Validate writes separately from the permissive reader for older saved records. */
export function isStudioData(value: unknown): value is StudioData {
  if (!record(value) || value.version !== 1 || !record(value.settings)) return false;
  if (!['defaultMarkup', 'defaultWastage', 'labourRate', 'vatRate'].every(key => typeof value.settings === 'object' && value.settings !== null && nonnegative((value.settings as Record<string, unknown>)[key]))) return false;
  for (const key of collections) {
    const rows = value[key];
    if (!Array.isArray(rows) || !rows.every(row => record(row) && typeof row.id === 'string' && row.id.length > 0)) return false;
  }
  const data = value as unknown as StudioData;
  if (!data.inventory.every(row => typeof row.name === 'string' && [row.costPerStem, row.stemsPurchased, row.stemsRemaining].every(nonnegative))) return false;
  if (!data.wastage.every(row => typeof row.name === 'string' && typeof row.recordedAt === 'string' && [row.quantity, row.unitCost].every(nonnegative))) return false;
  if (!data.materials.every(row => typeof row.name === 'string' && nonnegative(row.unitCost))) return false;
  if (!data.customers.every(row => typeof row.name === 'string')) return false;
  if (![...data.quotes, ...data.jobs].every(row => typeof row.clientName === 'string' && Array.isArray(row.lines) && row.lines.every(line => record(line) && typeof line.name === 'string' && nonnegative(line.quantity) && nonnegative(line.unitCost)) && [row.labourHours, row.labourRate, row.wastagePercent, row.markupPercent, row.deliveryFee, row.discount, row.vatRate].every(nonnegative))) return false;
  if (!data.jobs.every(row => record(row.totals) && Object.values(row.totals).every(value => typeof value === 'number' && Number.isFinite(value)))) return false;
  if (!data.plans.every(row => typeof row.clientName === 'string' && typeof row.notes === 'string' && (!row.references || (Array.isArray(row.references) && row.references.every(image => record(image) && typeof image.dataUrl === 'string'))))) return false;
  if (!data.weddingBuilds.every(row => typeof row.clientName === 'string' && Array.isArray(row.inventory) && Array.isArray(row.arrangements) && Array.isArray(row.materials) && row.inventory.every(flower => record(flower) && [flower.costPerStem, flower.purchases, flower.stemsPerPurchase].every(nonnegative)) && row.materials.every(material => record(material) && [material.unitCost, material.quantity].every(nonnegative)) && row.arrangements.every(arrangement => record(arrangement) && nonnegative(arrangement.quantity) && Array.isArray(arrangement.flowers) && arrangement.flowers.every(flower => record(flower) && nonnegative(flower.stemsPerArrangement))) && nonnegative(row.markupPercent) && nonnegative(row.vatRate))) return false;
  if (!data.plans.every(plan => !plan.setupOptions || (Array.isArray(plan.setupOptions) && plan.setupOptions.every(option => record(option) && typeof option.id === 'string' && typeof option.title === 'string' && typeof option.description === 'string' && typeof option.selected === 'boolean' && Number.isInteger(option.quantity) && option.quantity > 0 && (option.unitPrice === null || nonnegative(option.unitPrice)) && (option.photoSrc === '' || (typeof option.photoSrc === 'string' && option.photoSrc.length <= 1_500_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(option.photoSrc)) || /^\/assets\/weddings\/wedding-(02|03|04|05|07|09)\.jpg$/.test(option.photoSrc)))))) return false;
  return true;
}

function nonnegative(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
