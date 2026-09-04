import { createHash } from 'node:crypto';
import { STUDIO_WORKSPACE } from '@/lib/studio-database';
import { boundedBody, getInvoice, InvoiceError, invoiceAccess, invoiceFailure, invoiceJson } from '@/lib/supplier-invoice-server';
import { toInventoryBatches, validateSupplierInvoice } from '@/lib/supplier-invoice-validation';
import type { SupplierInvoiceDraft } from '@/lib/supplier-invoices';

export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const database = await invoiceAccess(request);
    const row = await getInvoice(database, (await context.params).id);
    const body = JSON.parse((await boundedBody(request, 200000)).toString('utf8'));
    if (body.confirmed !== true) throw new InvoiceError('Please confirm that you have checked the invoice and received the stock.');
    if (typeof body.expectedUpdatedAt !== 'string') throw new InvoiceError('Reopen the saved invoice review before confirming.', 409);
    const errors = validateSupplierInvoice(body.draft);
    if (errors.length) throw new InvoiceError(errors.slice(0, 4).join(' '));
    const draft = body.draft as SupplierInvoiceDraft;
    const canonical = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]/gu, '');
    if (!canonical(draft.supplier) || !canonical(draft.invoiceNumber)) throw new InvoiceError('Enter a supplier and invoice number containing letters or numbers.');
    const key = createHash('sha256').update(`${canonical(draft.supplier)}|${canonical(draft.invoiceNumber)}`).digest('hex');
    const { data, error } = await database.rpc('confirm_supplier_invoice', {
      p_id: row.id, p_workspace: STUDIO_WORKSPACE, p_draft: draft,
      p_items: toInventoryBatches(draft, row.id), p_invoice_key: key,
      p_expected_updated_at: body.expectedUpdatedAt,
    });
    if (error?.code === '23505') throw new InvoiceError('This supplier invoice has already been imported. No stock was added again.', 409);
    if (error?.code === 'P0001') throw new InvoiceError('The invoice is not ready to import. Reopen its saved review first.', 409);
    if (error) throw error;
    return invoiceJson(data);
  } catch (error) { return invoiceFailure(error); }
}
