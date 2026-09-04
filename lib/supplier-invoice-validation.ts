import type { SupplierInvoiceDraft } from './supplier-invoices';
import type { InventoryItem } from './types';

const MAX_MONEY = 1_000_000;
const MAX_PACKS = 100_000;
const MAX_STOCK_UNITS = 1_000_000;
const STOCK_UNITS = new Set(['stem', 'bunch', 'unit', 'unknown']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, limit: number, required = false): value is string {
  return typeof value === 'string' && value.length <= limit && (!required || value.trim().length > 0);
}

function validNumber(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= limit;
}

function hasPrecision(value: number, decimalPlaces: number): boolean {
  const scaled = value * 10 ** decimalPlaces;
  return Math.abs(scaled - Math.round(scaled)) < 0.000001;
}

function money(value: unknown, decimalPlaces = 2): value is number {
  return validNumber(value, MAX_MONEY) && hasPrecision(value, decimalPlaces);
}

function signedMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_MONEY && hasPrecision(value, 2);
}

function positiveInteger(value: unknown): value is number {
  return validNumber(value, MAX_PACKS) && Number.isInteger(value) && value > 0;
}

function realIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function pennies(value: number): number {
  return Math.round(value * 100);
}

// Unit prices may have four decimals; invoice line totals are rounded to pennies.
function expectedLinePennies(unitCost: number, quantity: number): number {
  return Math.round((Math.round(unitCost * 10_000) * quantity) / 100);
}

/** Validate untrusted OCR output and edited drafts again at the import boundary. */
export function validateSupplierInvoice(value: unknown): string[] {
  if (!isRecord(value)) return ['The supplier invoice must be an object.'];

  const errors: string[] = [];
  if (!validText(value.supplier, 200, true)) errors.push('Enter a supplier name (up to 200 characters).');
  if (value.supplierDetails !== undefined) {
    if (!isRecord(value.supplierDetails)) {
      errors.push('Supplier details must be an object containing account number, address, email, phone and VAT number.');
    } else {
      for (const [key, label, limit] of [
        ['accountNumber', 'account number', 100], ['address', 'address', 1_000],
        ['email', 'email', 200], ['phone', 'phone', 100], ['vatNumber', 'VAT number', 100],
      ] as const) {
        if (!validText(value.supplierDetails[key], limit)) errors.push(`Supplier ${label} must be text up to ${limit.toLocaleString('en-GB')} characters.`);
      }
    }
  }
  if (!validText(value.invoiceNumber, 100, true)) errors.push('Enter an invoice number (up to 100 characters).');
  if (!realIsoDate(value.invoiceDate)) errors.push('Enter a real invoice date in YYYY-MM-DD format.');
  if (value.currency !== 'GBP') errors.push('Only GBP supplier invoices can be imported.');
  if (!Array.isArray(value.warnings) || value.warnings.length > 100 || !value.warnings.every((warning) => validText(warning, 1_000))) {
    errors.push('Invoice warnings must be a list of up to 100 short messages.');
  }

  for (const [key, label] of [['subtotal', 'subtotal'], ['vat', 'VAT'], ['total', 'total']] as const) {
    if (!money(value[key])) errors.push(`Invoice ${label} must be a non-negative amount, no more than £1,000,000, with at most two decimal places. Credit invoices are not supported.`);
  }
  if (!signedMoney(value.otherCharges)) errors.push('Other charges or invoice-level discounts must be between -£1,000,000 and £1,000,000, with at most two decimal places.');

  if (!Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 100) {
    errors.push('Include between 1 and 100 invoice lines.');
    return errors;
  }

  let lineTotalPennies = 0;
  let allLineTotalsValid = true;
  let includedCount = 0;
  value.lines.forEach((line: unknown, index: number) => {
    const label = `Line ${index + 1}`;
    if (!isRecord(line)) {
      errors.push(`${label} must be an invoice line object.`);
      allLineTotalsValid = false;
      return;
    }
    if (!validText(line.name, 200, true)) errors.push(`${label}: enter an item name (up to 200 characters).`);
    if (!validText(line.code, 100)) errors.push(`${label}: supplier code must be text up to 100 characters.`);
    if (!validText(line.colour, 100)) errors.push(`${label}: colour must be text up to 100 characters.`);
    if (!validText(line.note, 1_000)) errors.push(`${label}: note must be text up to 1,000 characters.`);
    if (typeof line.include !== 'boolean') errors.push(`${label}: choose whether to add this line to inventory.`);
    if (line.include === true) includedCount += 1;
    if (typeof line.stockUnit !== 'string' || !STOCK_UNITS.has(line.stockUnit)) {
      errors.push(`${label}: stock unit must be stem, bunch, unit or unknown.`);
    } else if (line.include === true && line.stockUnit === 'unknown') {
      errors.push(`${label}: confirm whether the stock is measured in stems, bunches or units before importing.`);
    }

    const validPackSize = positiveInteger(line.packSize);
    const validPacks = positiveInteger(line.packs);
    const validUnitCost = money(line.unitCost, 4);
    const validLineTotal = money(line.lineTotal);
    if (!validPackSize) errors.push(`${label}: pack size must be a whole number from 1 to 100,000.`);
    if (!validPacks) errors.push(`${label}: quantity of packs must be a whole number from 1 to 100,000.`);
    if (!validUnitCost) errors.push(`${label}: unit cost must be a non-negative amount up to £1,000,000, with at most four decimal places.`);
    if (!validLineTotal) {
      errors.push(`${label}: line total must be a non-negative amount up to £1,000,000, with at most two decimal places. Credit lines are not supported.`);
      allLineTotalsValid = false;
    } else {
      // Excluding a line from stock must never remove its value from the invoice.
      lineTotalPennies += pennies(line.lineTotal as number);
    }

    if (validPackSize && validPacks) {
      const quantity = (line.packSize as number) * (line.packs as number);
      if (quantity > MAX_STOCK_UNITS) errors.push(`${label}: the total quantity cannot exceed 1,000,000 stock units.`);
      if (validUnitCost && validLineTotal && expectedLinePennies(line.unitCost as number, quantity) !== pennies(line.lineTotal as number)) {
        errors.push(`${label}: pack size × packs × unit cost does not match the line total.`);
      }
    }
  });

  if (includedCount === 0) errors.push('Select at least one invoice line to add to inventory.');
  if (allLineTotalsValid && signedMoney(value.otherCharges) && money(value.subtotal) && lineTotalPennies + pennies(value.otherCharges) !== pennies(value.subtotal)) {
    errors.push('All invoice line totals plus other charges must match the invoice subtotal, including lines excluded from inventory.');
  }
  if (money(value.subtotal) && money(value.vat) && money(value.total) && pennies(value.subtotal) + pennies(value.vat) !== pennies(value.total)) {
    errors.push('Invoice subtotal plus VAT must match the total payable.');
  }
  return errors;
}

/** New delivery batches only: existing quantities and historical job costs are untouched. */
export function toInventoryBatches(draft: SupplierInvoiceDraft, importId: string): InventoryItem[] {
  const errors = validateSupplierInvoice(draft);
  if (errors.length > 0) throw new Error(errors.join(' '));
  if (typeof importId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(importId)) throw new Error('A valid supplier invoice import ID is required.');

  return draft.lines.flatMap((line, index) => {
    if (!line.include) return [];
    if (line.stockUnit === 'unknown') throw new Error('Confirm the stock unit before importing.');
    const quantity = (line.packSize as number) * (line.packs as number);
    const unitSuffix = line.stockUnit === 'stem' ? '' : ` (${line.stockUnit})`;
    const batch = {
      id: `${importId}:${index}`,
      name: `${line.name.trim()}${unitSuffix}`,
      colour: line.colour.trim(),
      costPerStem: line.unitCost as number,
      stemsPurchased: quantity,
      stemsRemaining: quantity,
      supplierInvoiceId: importId,
      supplier: draft.supplier.trim(),
      supplierCode: line.code.trim(),
      receivedAt: draft.invoiceDate,
      stockUnit: line.stockUnit,
    };
    return [batch];
  });
}
