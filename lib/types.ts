export type LineCategory = 'stem' | 'sundry';

export interface InventoryItem {
  id: string;
  name: string;
  costPerStem: number;
  stemsPurchased: number;
  stemsRemaining: number;
}

export interface QuoteLine {
  id: string;
  inventoryId: string | null;
  name: string;
  category: LineCategory;
  quantity: number;
  unitCost: number;
}

export interface Quote {
  id: string;
  clientName: string;
  occasion: 'Bouquet' | 'Wedding' | 'Funeral' | 'Corporate';
  eventDate: string;
  lines: QuoteLine[];
  labourHours: number;
  labourRate: number;
  wastagePercent: number;
  markupPercent: number;
  deliveryFee: number;
  discount: number;
  vatApplies: boolean;
  vatRate: number;
  createdAt: string;
}

export interface Job extends Quote {
  wonAt: string;
  stockReturned: boolean;
  totals: QuoteTotals;
}

export interface WeddingPlan {
  id: string;
  clientName: string;
  type: 'Wedding' | 'Funeral' | 'Corporate';
  eventDate: string;
  notes: string;
  finishedEstimate: number | null;
  createdAt: string;
}

export interface Settings {
  defaultMarkup: number;
  defaultWastage: number;
  labourRate: number;
  vatRate: number;
}

export interface QuoteTotals {
  stemCost: number;
  sundryCost: number;
  materialCost: number;
  wastage: number;
  labour: number;
  costSubtotal: number;
  markup: number;
  netTotal: number;
  vat: number;
  grossTotal: number;
  profit: number;
  marginPercent: number;
}

export interface StudioData {
  version: number;
  inventory: InventoryItem[];
  quotes: Quote[];
  jobs: Job[];
  plans: WeddingPlan[];
  settings: Settings;
}

