import { requireSameOrigin } from './request-body';
import { NextResponse } from 'next/server';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import type { SupplierInvoiceDraft, SupplierInvoiceRecord, InvoiceStockUnit } from '@/lib/supplier-invoices';

export const INVOICE_BUCKET = 'supplier-invoices';
export const INVOICE_MODEL = 'openai/gpt-5.6-sol';
export const invoiceJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});
export class InvoiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function invoiceAccess(request: Request) {
  if (!await hasStudioSession()) throw new InvoiceError('Please sign in to use supplier invoices.', 401);
  try { requireSameOrigin(request); } catch { throw new InvoiceError('Please upload from your Studio page.', 403); }
  const database = createStudioDatabaseClient();
  if (!database) throw new InvoiceError('The Supabase server key is missing from Vercel. No stock has been changed.', 503);
  return database;
}
export function invoiceFailure(error: unknown) {
  if (error instanceof InvoiceError) return invoiceJson({ error: error.message }, error.status);
  // Do not log provider errors: they can contain invoice contents or credentials.
  console.error('[supplier-invoices] Request failed; check database and AI Gateway configuration.');
  return invoiceJson({ error: 'The invoice could not be saved. Check the database connection, then reopen the saved invoice before retrying.' }, 503);
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new InvoiceError('This upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InvoiceError('The upload is empty.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new InvoiceError('This upload is too large.', 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function imageMediaType(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 12) throw new InvoiceError('Please choose a valid JPEG, PNG or WebP photograph.');
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new InvoiceError('Please choose a JPEG, PNG or WebP image, not a PDF or HEIC file.');
}
const string = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
// Persist incomplete extraction safely. Import validation is deliberately stricter.
export function normaliseInvoiceDraft(value: unknown): SupplierInvoiceDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvoiceError('The invoice could not be read. Please try a clearer photograph.');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.lines) || raw.lines.length > 100) throw new InvoiceError('Use an invoice with up to 100 flower lines.');
  const details = raw.supplierDetails && typeof raw.supplierDetails === 'object' ? raw.supplierDetails as Record<string, unknown> : {};
  return {
    supplier: string(raw.supplier), invoiceNumber: string(raw.invoiceNumber, 100), invoiceDate: string(raw.invoiceDate, 10),
    supplierDetails: { accountNumber: string(details.accountNumber, 100), address: string(details.address, 1000),
      email: string(details.email), phone: string(details.phone, 100), vatNumber: string(details.vatNumber, 100) },
    currency: string(raw.currency, 3), subtotal: number(raw.subtotal), vat: number(raw.vat), total: number(raw.total),
    otherCharges: number(raw.otherCharges) ?? 0,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.slice(0, 30).map(w => string(w, 600)) : [],
    lines: raw.lines.map(value => {
      const line = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      return { code: string(line.code, 100), name: string(line.name), colour: string(line.colour, 100),
        packSize: number(line.packSize), packs: number(line.packs), unitCost: number(line.unitCost), lineTotal: number(line.lineTotal),
        stockUnit: (['stem','bunch','unit','unknown'].includes(String(line.stockUnit)) ? line.stockUnit : 'unknown') as InvoiceStockUnit,
        include: line.include === true, note: string(line.note, 600) };
    }),
  };
}
export function publicInvoice(row: Record<string, unknown>): SupplierInvoiceRecord {
  return { id: row.id as string, filename: row.filename as string, status: row.status as SupplierInvoiceRecord['status'],
    created_at: row.created_at as string, updated_at: row.updated_at as string, imported_at: row.imported_at as string | null,
    draft: row.draft as SupplierInvoiceDraft | null, error_message: row.error_message as string | null };
}
export async function getInvoice(database: NonNullable<ReturnType<typeof createStudioDatabaseClient>>, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new InvoiceError('Invoice not found.', 404);
  const { data, error } = await database.from('supplier_invoice_imports').select('*').eq('workspace_key', STUDIO_WORKSPACE).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new InvoiceError('Invoice not found.', 404);
  return data;
}

