// Shared, non-secret data contract for supplier invoice review.
export type InvoiceStockUnit = 'stem' | 'bunch' | 'unit' | 'unknown';
export interface SupplierInvoiceLine {
  code: string;
  name: string;
  colour: string;
  packSize: number | null;
  packs: number | null;
  unitCost: number | null;
  lineTotal: number | null;
  stockUnit: InvoiceStockUnit;
  include: boolean;
  note: string;
}
export interface SupplierInvoiceDraft {
  supplier: string;
  supplierDetails?: { accountNumber: string; address: string; email: string; phone: string; vatNumber: string };
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  // Delivery, discounts and other non-stock charges, excluding VAT.
  otherCharges: number;
  warnings: string[];
  lines: SupplierInvoiceLine[];
}
export interface SupplierInvoiceRecord {
  id: string;
  status: 'processing' | 'review' | 'imported' | 'failed';
  filename: string;
  created_at: string;
  updated_at: string;
  imported_at: string | null;
  draft: SupplierInvoiceDraft | null;
  error_message: string | null;
}
export const MAX_INVOICE_BYTES = 3 * 1024 * 1024;
