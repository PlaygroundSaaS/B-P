import type { RecipeExtras, OperationsData, EventDetails, InspirationSelection, EventRequirement, StudioAsset } from './operations-types';
export type LineCategory = 'stem' | 'sundry';

export interface InventoryItem {
  id: string;
  name: string;
  colour?: string;
  costPerStem: number;
  stemsPurchased: number;
  stemsRemaining: number;
  stockUnit?: 'stem' | 'bunch' | 'unit';
  supplierInvoiceId?: string;
  supplier?: string;
  supplierCode?: string;
  receivedAt?: string;
  category?: string;
  batch?: string;
  purchaseDate?: string;
  usableDate?: string;
  expiryDate?: string;
  season?: string;
  location?: string;
  notes?: string;
  image?: StudioAsset;
}

export interface WastageRecord {
  notes?: string;
  image?: StudioAsset;
  id: string;
  inventoryId: string;
  name: string;
  quantity: number;
  unitCost: number;
  reason?: string;
  recordedAt: string;
  stockUnit?: 'stem' | 'bunch' | 'unit';
}

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
}

export interface Customer {
  preferredFlowers?: string;
  preferredColours?: string;
  anniversary?: string;
  importantDates?: string;
  id: string;
  name: string;
  contact: string;
  notes: string;
  createdAt: string;
}

export interface QuoteLine {
  costCategory?: 'Flower' | 'Packaging' | 'Sundry';
  stockUnit?: 'stem' | 'bunch' | 'unit';
  id: string;
  inventoryId: string | null;
  name: string;
  category: LineCategory;
  quantity: number;
  unitCost: number;
}

export interface Quote extends RecipeExtras {
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
  customerId?: string;
  details?: EventDetails;
  inspiration?: InspirationSelection[];
  requirements?: EventRequirement[];
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
  personRemembered?: string;
  serviceTime?: string;
  funeralDirector?: string;
  serviceWishes?: string;
  cardMessage?: string;
  eventFormat?: string;
  guestCount?: number | null;
  setupWindow?: string;
  breakdownTime?: string;
  venueRestrictions?: string;
  budget?: number | null;
  palette?: string;
  favouriteFlowers?: string;
  avoidFlowers?: string;
  arrangements?: string;
  contact?: string;
  status?: 'Enquiry' | 'Planning' | 'Proposal sent' | 'Booked';
  references?: PlanReferenceImage[];
  materialsNeeded?: PlanMaterial[];
  setupOptions?: WeddingSetupOption[];
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
  corporationTaxRate?: number;
  defaultMarkup: number;
  defaultWastage: number;
  labourRate: number;
  vatRate: number;
}

export interface QuoteTotals {
  packagingCost?: number;
  deliveryCost?: number;
  setupCost?: number;
  collectionCost?: number;
  supplierCharges?: number;
  additionalExpenses?: number;
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
  operations?: OperationsData;
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


export interface WeddingSetupOption {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  photoSrc: string;
  selected: boolean;
}
