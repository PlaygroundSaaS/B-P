export type LineCategory = 'stem' | 'sundry';

export interface InventoryItem {
  id: string;
  name: string;
  colour?: string;
  costPerStem: number;
  stemsPurchased: number;
  stemsRemaining: number;
}

export interface WastageRecord {
  id: string;
  inventoryId: string;
  name: string;
  quantity: number;
  unitCost: number;
  reason?: string;
  recordedAt: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  notes: string;
  createdAt: string;
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
  contact?: string;
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
  notes?: string;
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
  venue?: string;
  brideHeight?: string;
  tableCount?: number | null;
  mainTableSize?: string;
  budget?: number | null;
  palette?: string;
  favouriteFlowers?: string;
  avoidFlowers?: string;
  arrangements?: string;
  contact?: string;
  status?: 'Enquiry' | 'Planning' | 'Proposal sent' | 'Booked';
  references?: PlanReferenceImage[];
  materialsNeeded?: PlanMaterial[];
}

export interface PlanMaterial {
  id: string;
  name: string;
  quantity: number;
  status: 'Needed' | 'In stock' | 'Ordered' | 'Ready';
}

export interface WeddingInventoryFlower {
  id: string;
  name: string;
  costPerStem: number;
  stemsPerPurchase: number;
  purchases: number;
}

export interface WeddingArrangementFlower {
  id: string;
  inventoryId: string | null;
  name: string;
  stemsPerArrangement: number;
}

export interface WeddingArrangement {
  id: string;
  name: string;
  quantity: number;
  flowers: WeddingArrangementFlower[];
  notes?: string;
}

export interface WeddingMaterialCost {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface WeddingBuild {
  id: string;
  planId: string;
  clientName: string;
  arrangements: WeddingArrangement[];
  inventory: WeddingInventoryFlower[];
  materials: WeddingMaterialCost[];
  markupPercent: number;
  vatRate: number;
  updatedAt: string;
}

export interface PlanReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
  caption?: string;
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
  wastage: WastageRecord[];
  materials: Material[];
  customers: Customer[];
  quotes: Quote[];
  jobs: Job[];
  plans: WeddingPlan[];
  weddingBuilds: WeddingBuild[];
  settings: Settings;
}
