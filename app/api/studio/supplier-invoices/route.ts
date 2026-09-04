import { createHash, randomUUID } from 'node:crypto';
import { STUDIO_WORKSPACE } from '@/lib/studio-database';
import { MAX_INVOICE_BYTES } from '@/lib/supplier-invoices';
import { boundedBody, imageMediaType, INVOICE_BUCKET, INVOICE_MODEL, InvoiceError, invoiceAccess, invoiceFailure, invoiceJson, publicInvoice } from '@/lib/supplier-invoice-server';
import { readSupplierInvoice } from '@/lib/supplier-invoice-reader';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const database = await invoiceAccess(request);
    const offset = Math.max(0, Math.min(100000, Math.floor(Number(new URL(request.url).searchParams.get('offset')) || 0)));
    const { data, error } = await database.from('supplier_invoice_imports')
      .select('id,status,filename,created_at,updated_at,imported_at,draft,error_message')
      .eq('workspace_key', STUDIO_WORKSPACE).order('created_at', { ascending: false }).order('id').range(offset, offset + 50);
    if (error) throw error;
    return invoiceJson({ invoices: (data || []).slice(0, 50).map(publicInvoice), hasMore: (data?.length || 0) > 50, nextOffset: offset + 50 });
  } catch (error) { return invoiceFailure(error); }
}

export async function POST(request: Request) {
  try {
    const database = await invoiceAccess(request);
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new InvoiceError('Choose an invoice photograph to upload.');
    const raw = await boundedBody(request, MAX_INVOICE_BYTES + 65536);
    const form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new InvoiceError('Choose an invoice photograph to upload.');
    if (file.size > MAX_INVOICE_BYTES) throw new InvoiceError('Please use an image smaller than 3 MB.', 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mediaType = imageMediaType(bytes);
    if (!process.env.VERCEL && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
      throw new InvoiceError('The invoice reader needs AI Gateway access. Configure it on Vercel before scanning. No stock has been changed.', 503);
    }
    const { data: state, error: stateError } = await database.from('studio_app_state').select('workspace_key').eq('workspace_key', STUDIO_WORKSPACE).maybeSingle();
    if (stateError) throw stateError;
    if (!state) throw new InvoiceError('Save your Studio to Supabase first, then upload the invoice.', 409);
    const id = randomUUID();
    const hash = createHash('sha256').update(bytes).digest('hex');
    const path = `${STUDIO_WORKSPACE}/${id}`;
    const { data: reservation, error: reserveError } = await database.rpc('reserve_supplier_invoice', {
      p_id: id, p_workspace: STUDIO_WORKSPACE, p_hash: hash,
      p_filename: file.name.replace(/[\x00-\x1f]/g, '').slice(0, 180), p_storage_path: path,
      p_model: INVOICE_MODEL, p_actor: process.env.STUDIO_USERNAME?.trim() || 'jade',
    });
    if (reserveError) {
      if (reserveError.code === 'P0001') throw new InvoiceError('Please wait for the current scan, or try again later if the scanning limit has been reached.', 429);
      throw reserveError;
    }
    if (!reservation?.invoice) throw new Error('Invoice reservation unavailable');
    const row = reservation.invoice as Record<string, unknown>;
    if (!reservation.reserved) return invoiceJson({ invoice: publicInvoice(row) });
    const invoiceId = row.id as string;
    try {
      const { error: storageError } = await database.storage.from(INVOICE_BUCKET).upload(row.storage_path as string, bytes, { contentType: mediaType, upsert: true });
      if (storageError) throw storageError;
      const result = await readSupplierInvoice(bytes, mediaType);
      const { data: saved, error: saveError } = await database.from('supplier_invoice_imports').update({
        status: 'review', draft: result.draft, extraction: result.draft, usage: result.usage,
        estimated_cost_usd: result.estimatedCostUsd, updated_at: new Date().toISOString(), error_message: null,
      }).eq('id', invoiceId).eq('workspace_key', STUDIO_WORKSPACE).eq('status', 'processing').eq('attempts', row.attempts).select('*').single();
      if (saveError) throw saveError;
      return invoiceJson({ invoice: publicInvoice(saved) });
    } catch {
      const message = 'The photograph could not be read. Check AI Gateway access and the database connection, then upload it again. No stock was added.';
      await database.from('supplier_invoice_imports').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
        .eq('id', invoiceId).eq('workspace_key', STUDIO_WORKSPACE).eq('status', 'processing').eq('attempts', row.attempts);
      return invoiceJson({ error: message, invoiceId }, 503);
    }
  } catch (error) { return invoiceFailure(error); }
}
