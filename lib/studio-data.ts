import { DEFAULT_SETTINGS, emptyStudio, num } from './pricing';
import type { StudioData } from './types';

export function reviveData(value: unknown): StudioData {
  const raw = value && typeof value === 'object' ? value as Partial<StudioData> : {};
  return {
    version: 1,
    inventory: Array.isArray(raw.inventory) ? raw.inventory.map(item => ({ ...item, costPerStem: num(item.costPerStem), stemsPurchased: num(item.stemsPurchased), stemsRemaining: num(item.stemsRemaining) })) : [],
    materials: Array.isArray(raw.materials) ? raw.materials.map(material => ({ ...material, unitCost: num(material.unitCost) })) : [],
    customers: Array.isArray(raw.customers) ? raw.customers : [],
    quotes: Array.isArray(raw.quotes) ? raw.quotes : [],
    jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
    plans: Array.isArray(raw.plans) ? raw.plans : [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
  };
}
export const blankData = emptyStudio;

