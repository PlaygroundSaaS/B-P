import { getInvoice, INVOICE_BUCKET, invoiceAccess, invoiceFailure } from '@/lib/supplier-invoice-server';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const database = await invoiceAccess(request);
    const row = await getInvoice(database, (await context.params).id);
    const { data, error } = row.source_image_base64
      ? { data: new Blob([Buffer.from(row.source_image_base64, 'base64')], { type: row.source_image_media_type }), error: null }
      : await database.storage.from(INVOICE_BUCKET).download(row.storage_path);
    if (error || !data) throw error;
    return new Response(data, { headers: { 'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="supplier-invoice"', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return invoiceFailure(error); }
}
