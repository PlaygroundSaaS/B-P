import { STUDIO_WORKSPACE } from '@/lib/studio-database';
import { boundedBody, getInvoice, InvoiceError, invoiceAccess, invoiceFailure, invoiceJson, normaliseInvoiceDraft, publicInvoice } from '@/lib/supplier-invoice-server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const database = await invoiceAccess(request);
    return invoiceJson({ invoice: publicInvoice(await getInvoice(database, (await context.params).id)) });
  } catch (error) { return invoiceFailure(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const database = await invoiceAccess(request);
    const row = await getInvoice(database, (await context.params).id);
    if (row.status !== 'review') throw new InvoiceError('Only an invoice awaiting review can be edited.', 409);
    const body = JSON.parse((await boundedBody(request, 200000)).toString('utf8'));
    if (typeof body.expectedUpdatedAt !== 'string' || body.expectedUpdatedAt !== row.updated_at) {
      throw new InvoiceError('This invoice changed in another tab. Reopen the latest review before saving.', 409);
    }
    const draft = normaliseInvoiceDraft(body.draft);
    const { data, error } = await database.from('supplier_invoice_imports')
      .update({ draft, updated_at: new Date().toISOString() }).eq('id', row.id)
      .eq('workspace_key', STUDIO_WORKSPACE).eq('status', 'review').eq('updated_at', body.expectedUpdatedAt).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new InvoiceError('This invoice has already been imported. Reopen it to see its status.', 409);
    return invoiceJson({ invoice: publicInvoice(data) });
  } catch (error) { return invoiceFailure(error); }
}
