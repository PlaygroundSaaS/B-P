import type { Quote, QuoteTotals } from './types';

export type RecipeStatus = 'DRAFT' | 'QUOTE' | 'PURCHASED';
export type ProductionStatus = 'Not started' | 'Prepped' | 'In production' | 'Completed' | 'Packed' | 'Delivered';
export type LeadStatus = 'New enquiry' | 'Contacted' | 'Consultation booked' | 'Estimate sent' | 'Quote sent' | 'Awaiting decision' | 'Won' | 'Lost';
export interface StudioAsset { id: string; name: string; url: string; type: string; }
export interface InspirationItem {
  id: string; name: string; category: string; images: StudioAsset[]; description: string;
  style: string; palette: string; season: string; occasion: 'Wedding' | 'Funeral' | 'Corporate' | 'Other';
  flowers: string; size: string; stemRange: string; priceFrom: number; priceTo: number; tags: string; active: boolean;
}
export interface InspirationSelection {
  id: string; inspirationId: string; name: string; category: string; image: string; description: string;
  quantity: number; priceFrom: number; priceTo: number; palette: string; notes: string; recipeId?: string;
}
export interface EventRequirement { id: string; name: string; quantity: number; notes: string; recipeId?: string; }
export interface EventDetails {
  ceremonyTime?: string; ceremonyVenue?: string; receptionVenue?: string; weddingParty?: string; theme?: string;
  consultationNotes?: string; inspirationLinks?: string; documents?: StudioAsset[]; venueInformation?: string;
  deliveryRequirements?: string; collectionTime?: string; funeralDirectorContact?: string; deliveryDeadline?: string;
  consultationDate?: string; consultationTime?: string; followUpDate?: string; actions?: string;
}
export interface StockCommitment { inventoryId: string; quantity: number; }
export interface RecipeExtras {
  invoicedAt?: string;
  sellingPriceExVat?: number;
  corporationTaxRate?: number;
  deliveryCost?: number; setupCost?: number; collectionCost?: number; supplierCharges?: number; additionalExpenses?: number;
  status?: RecipeStatus; name?: string; quantity?: number; planId?: string; customerId?: string;
  inspirationId?: string; inspirationImage?: string; palette?: string; estimatedBudget?: string;
  isTemplate?: boolean; favourite?: boolean; updatedAt?: string; instructions?: string;
  productionStatus?: ProductionStatus; assignedTo?: string; productionDue?: string;
  commitments?: StockCommitment[]; consumedAt?: string; cancelledAt?: string; paymentDue?: string; depositDue?: number;
}
export interface EventQuote {
  id: string; planId: string; clientName: string; name: string; recipeIds: string[];
  recipes: { id: string; name: string; quantity: number; total: number; vat: number; revision: string }[];
  setup: number; delivery: number; discount: number; vatRate: number; vatApplies: boolean;
  total: number; vat: number; status: 'QUOTE' | 'PURCHASED'; createdAt: string; updatedAt: string;
  purchasedAt?: string; paymentDue?: string; depositDue?: number; terms: string;
  approval?: { status: 'Pending' | 'Approved' | 'Changes requested'; comments: string; recordedAt: string; recordedBy: 'Studio' | 'Client'; termsAccepted: boolean };
  hire?: number; otherCost?: number; setupCost?: number; deliveryCost?: number; invoicedAt?: string;
  stages?: { id: string; name: string; amount: number; due: string }[];
}
export interface Supplier {
  id: string; name: string; contact: string; email: string; phone: string; website: string; account: string;
  products: string; minimumOrder: number; deliveryDays: string; leadTime: string; notes: string;
}
export interface PurchaseOrder {
  id: string; supplierId: string; supplierName: string; date: string; expectedDelivery: string;
  status: 'Draft' | 'Ordered' | 'Received'; notes: string;
  lines: { inventoryId: string; name: string; quantity: number; unitCost: number }[];
}
export interface Lead {
  id: string; clientName: string; contact: string; occasion: 'Wedding' | 'Funeral' | 'Corporate' | 'Retail' | 'Other';
  status: LeadStatus; eventDate: string; followUpDate: string; consultationDate: string; consultationTime: string;
  notes: string; createdAt: string; customerId?: string; planId?: string;
}
export interface CRMEntry {
  id: string; customerId: string; kind: 'Note' | 'Message' | 'Consultation' | 'Document' | 'Follow-up';
  text: string; date: string; dueDate: string; completed: boolean; assets: StudioAsset[];
}
export interface Delivery {
  id: string; planId: string; clientName: string; address: string; venue: string; contact: string; phone: string;
  date: string; window: string; setupTime: string; collectionDate: string; collectionTime: string;
  driver: string; vehicle: string; notes: string; access: string; parking: string; setupRequirements: string;
  status: 'Planned' | 'Packed' | 'Out for delivery' | 'Delivered' | 'Collected'; proof?: StudioAsset;
  checklist: { id: string; stage: 'Delivery' | 'Setup' | 'Collection'; text: string; done: boolean }[];
}
export interface HireItem { id: string; name: string; category: string; quantity: number; replacementCost: number; notes: string; }
export interface HireReservation {
  id: string; itemId: string; planId: string; clientName: string; quantity: number; from: string; to: string;
  status: 'Reserved' | 'Out' | 'Returned'; returned: number; damaged: number; lost: number; notes: string;
}
export interface Payment {
  id: string; orderId: string; clientName: string; amount: number; date: string;
  method: 'Bank transfer' | 'Cash' | 'Card elsewhere' | 'Other'; kind: 'Deposit' | 'Balance' | 'Refund'; reference: string;
}
export interface OperationsData {
  catalogue: InspirationItem[]; eventQuotes: EventQuote[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[];
  leads: Lead[]; crm: CRMEntry[]; deliveries: Delivery[]; hireItems: HireItem[]; hireReservations: HireReservation[]; payments: Payment[];
  tasks: { id: string; planId: string; title: string; due: string; assignedTo: string; completed: boolean; notes: string }[];
  recurring: { id: string; customerId: string; clientName: string; recipeId: string; frequency: 'Weekly' | 'Fortnightly' | 'Monthly'; price: number; address: string; style: string; colours: string; variations: string; billing: string; start: string; end: string; nextDate: string; status: 'Active' | 'Paused' | 'Cancelled' }[];
  dismissedActions: { id: string; until: string }[];
}
export interface InventoryTransaction { inventoryId: string; name: string; quantity: number; kind: 'Commit' | 'Release' | 'Consume' | 'Waste' | 'Receipt' | 'Adjustment'; recordId: string; unitCost: number; }
export interface CommandResult { data: import('./types').StudioData; action: string; recordIds: string[]; transactions: InventoryTransaction[]; }
export type StudioCommand =
  | { type: 'saveRecipe'; recipe: Quote; status: 'DRAFT' | 'QUOTE' }
  | { type: 'purchaseRecipe'; recipeId: string; allowShortages: boolean }
  | { type: 'amendRecipe'; recipe: Quote; reason: string; allowShortages: boolean }
  | { type: 'returnRecipe'; recipeId: string; reason: string }
  | { type: 'production'; recipeId: string; status: ProductionStatus; assignedTo: string; due: string }
  | { type: 'saveEventQuote'; quote: EventQuote }
  | { type: 'purchaseEventQuote'; quoteId: string; allowShortages: boolean }
  | { type: 'recordApproval'; quoteId: string; status: 'Approved' | 'Changes requested'; comments: string; termsAccepted: boolean }
  | { type: 'issueInvoice'; orderId: string }
  | { type: 'payment'; payment: Payment }
  | { type: 'reserveHire'; reservation: HireReservation }
  | { type: 'returnHire'; id: string; returned: number; damaged: number; lost: number; notes: string }
  | { type: 'receivePurchaseOrder'; id: string }
  | { type: 'waste'; inventoryId: string; quantity: number; reason: string; date: string; notes: string; image?: StudioAsset };

export const emptyOperations = (): OperationsData => ({ catalogue: [], eventQuotes: [], suppliers: [], purchaseOrders: [], leads: [], crm: [], deliveries: [], hireItems: [], hireReservations: [], payments: [], tasks: [], recurring: [], dismissedActions: [] });
