'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { StudioData } from '@/lib/types';
import { MAX_INVOICE_BYTES } from '@/lib/supplier-invoices';
import type { InvoiceStockUnit, SupplierInvoiceDraft, SupplierInvoiceLine, SupplierInvoiceRecord } from '@/lib/supplier-invoices';
import { validateSupplierInvoice } from '@/lib/supplier-invoice-validation';
import styles from './supplier-invoice-import.module.css';

type Props = {
  disabled: boolean;
  onImporting: (busy: boolean) => void;
  onImported: (data: StudioData, updatedAt: string) => void;
};
type Operation = '' | 'upload' | 'load' | 'save' | 'confirm';
type InvoicePage = { invoices: SupplierInvoiceRecord[]; hasMore: boolean; nextOffset: number | null };
const API = '/api/studio/supplier-invoices';
const gbp = (value: number | null) => value === null || !Number.isFinite(value) ? 'Not read' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const readNumber = (value: string) => value.trim() === '' ? null : Number(value);
const newLine = (): SupplierInvoiceLine => ({ code: '', name: '', colour: '', packSize: null, packs: null, unitCost: null, lineTotal: null, stockUnit: 'unknown', include: true, note: '' });
const statusLabel = { processing: 'Reading photo', review: 'Review needed', imported: 'Added to stock', failed: 'Needs attention' };
const supplierKey = (name: string) => name.normalize('NFKC').toLowerCase().replace(/\blimited\b/g, 'ltd').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
const blankSupplierDetails = () => ({ accountNumber: '', address: '', email: '', phone: '', vatNumber: '' });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error || 'The request could not be completed. Please try again.');
  return payload;
}

// Phone originals stay untouched. Only the upload copy is resized when required.
async function preparePhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP photo. For an HEIC image, save or share it as a JPG first.');
  }
  if (file.size <= MAX_INVOICE_BYTES) return file;
  if (file.size > 30 * 1024 * 1024) throw new Error('This photo is too large. Export a smaller JPG and try again.');
  const url = URL.createObjectURL(file);
  try {
    const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This photo could not be opened. Please try a different JPG.'));
      element.src = url;
    });
    const scale = Math.min(1, 2200 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The photo could not be prepared. Please choose a photo under 3 MB.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.94, 0.85, 0.75]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_INVOICE_BYTES) return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    }
    throw new Error('The photo is still over 3 MB. Crop closely around the invoice and try again.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SupplierInvoiceImport({ disabled, onImporting, onImported }: Props) {
  const inputId = useId();
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [selected, setSelected] = useState<SupplierInvoiceRecord | null>(null);
  const [draft, setDraft] = useState<SupplierInvoiceDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [operation, setOperation] = useState<Operation>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const operationRef = useRef<Operation>('');
  const selectionEpoch = useRef(0);
  const mounted = useRef(true);
  const callbackRef = useRef(onImporting);
  callbackRef.current = onImporting;
  const locked = disabled || operation !== '';
  const editable = selected?.status === 'review' && !!draft;
  const problems = draft && editable ? validateSupplierInvoice(draft) : [];
  const included = draft?.lines.filter(line => line.include) ?? [];
  const linesTotal = draft?.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) ?? 0;
  const calculatedNet = draft?.lines.every(line => line.lineTotal !== null) ? linesTotal + draft.otherCharges : null;
  const supplierGroups = new Map<string, { name: string; records: SupplierInvoiceRecord[] }>();
  for (const invoice of invoices) {
    const name = invoice.draft?.supplier.trim() || 'Needs supplier';
    const key = invoice.draft?.supplier.trim() ? supplierKey(name) : '__unknown__';
    const group = supplierGroups.get(key) ?? { name, records: [] };
    group.records.push(invoice);
    supplierGroups.set(key, group);
  }
  const query = historySearch.trim().toLocaleLowerCase('en-GB');
  const visibleGroups = [...supplierGroups.entries()].map(([key, group]) => ({
    key,
    ...group,
    matches: group.records.filter(invoice => !query || [group.name, invoice.draft?.invoiceNumber, invoice.filename, invoice.draft?.supplierDetails?.accountNumber].some(value => value?.toLocaleLowerCase('en-GB').includes(query))),
  })).filter(group => group.matches.length > 0).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));

  const remember = (invoice: SupplierInvoiceRecord) => {
    setInvoices(current => [invoice, ...current.filter(item => item.id !== invoice.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  };
  const select = (invoice: SupplierInvoiceRecord) => {
    setSelected(invoice);
    setDraft(invoice.draft ? structuredClone(invoice.draft) : null);
    setDirty(false);
    setReviewed(false);
    remember(invoice);
    const url = new URL(window.location.href);
    url.searchParams.set('supplierInvoice', invoice.id);
    window.history.replaceState(window.history.state, '', url);
  };

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const selectedId = new URL(window.location.href).searchParams.get('supplierInvoice');
    request<InvoicePage>(API, { signal: controller.signal })
      .then(payload => { if (mounted.current) { setInvoices(current => [...current, ...payload.invoices.filter(invoice => !current.some(item => item.id === invoice.id))].sort((a, b) => b.created_at.localeCompare(a.created_at))); setHasMore(payload.hasMore); setNextOffset(payload.nextOffset); } })
      .catch(reason => { if (!controller.signal.aborted) setHistoryError(reason instanceof Error ? reason.message : 'Invoice history could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    if (selectedId) {
      request<{ invoice: SupplierInvoiceRecord }>(`${API}/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
        .then(({ invoice }) => { if (mounted.current && selectionEpoch.current === 0) { setSelected(invoice); setDraft(invoice.draft ? structuredClone(invoice.draft) : null); } })
        .catch(reason => { if (!controller.signal.aborted && selectionEpoch.current === 0) setError(reason instanceof Error ? reason.message : 'This invoice could not be loaded.'); });
    }
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!dirty && !operation) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty, operation]);

  const begin = (next: Operation) => {
    if (disabled || operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    setError('');
    setMessage('');
    onImporting(true);
    return true;
  };
  const finish = () => {
    operationRef.current = '';
    if (mounted.current) setOperation('');
    callbackRef.current(false);
  };
  const showError = (reason: unknown) => {
    if (mounted.current) setError(reason instanceof Error ? reason.message : 'Something went wrong. Your review has not been discarded.');
  };
  const canLeaveDraft = () => !dirty || window.confirm('Leave this unsaved invoice review? Choose Cancel to save your review first.');

  async function refreshHistory(loadMore = false) {
    if (locked || historyLoading) return;
    if (loadMore && nextOffset === null) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const payload = await request<InvoicePage>(loadMore ? `${API}?offset=${nextOffset}` : API);
      if (mounted.current) {
        setInvoices(current => loadMore ? [...current, ...payload.invoices.filter(invoice => !current.some(item => item.id === invoice.id))] : payload.invoices);
        setHasMore(payload.hasMore);
        setNextOffset(payload.nextOffset);
      }
    } catch (reason) {
      if (mounted.current) setHistoryError(reason instanceof Error ? reason.message : 'Invoice history could not be loaded.');
    } finally { if (mounted.current) setHistoryLoading(false); }
  }

  async function openInvoice(invoiceId: string) {
    if (!canLeaveDraft() || !begin('load')) return;
    selectionEpoch.current += 1;
    try {
      const payload = await request<{ invoice: SupplierInvoiceRecord }>(`${API}/${encodeURIComponent(invoiceId)}`);
      if (mounted.current) select(payload.invoice);
    } catch (reason) { showError(reason); } finally { finish(); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const source = event.target.files?.[0];
    event.target.value = '';
    if (!source || !canLeaveDraft() || !begin('upload')) return;
    selectionEpoch.current += 1;
    try {
      const file = await preparePhoto(source);
      const form = new FormData();
      form.append('file', file);
      const payload = await request<{ invoice: SupplierInvoiceRecord }>(API, { method: 'POST', body: form });
      if (mounted.current) {
        select(payload.invoice);
        if (payload.invoice.status === 'review') setMessage('Photo read. Check every line against the original before adding stock.');
        if (payload.invoice.status === 'imported') setMessage('This invoice has already been added to inventory. No stock was added again.');
      }
    } catch (reason) { showError(reason); } finally { finish(); }
  }

  function changeDraft(update: Partial<SupplierInvoiceDraft>) {
    setDraft(current => current ? { ...current, ...update } : null);
    setDirty(true);
    setReviewed(false);
    setMessage('');
  }
  function changeLine(index: number, update: Partial<SupplierInvoiceLine>) {
    if (!draft) return;
    changeDraft({ lines: draft.lines.map((line, position) => position === index ? { ...line, ...update } : line) });
  }
  function changeSupplierDetails(update: Partial<NonNullable<SupplierInvoiceDraft['supplierDetails']>>) {
    if (!draft) return;
    changeDraft({ supplierDetails: { ...blankSupplierDetails(), ...draft.supplierDetails, ...update } });
  }

  async function saveReview() {
    if (!selected || !draft || !begin('save')) return;
    try {
      const payload = await request<{ invoice: SupplierInvoiceRecord }>(`${API}/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, expectedUpdatedAt: selected.updated_at }),
      });
      if (mounted.current) { select(payload.invoice); setMessage('Review saved privately. You can return to it from invoice history.'); }
    } catch (reason) { showError(reason); } finally { finish(); }
  }

  async function confirmImport() {
    if (!selected || !draft || !reviewed || problems.length || !begin('confirm')) return;
    try {
      const payload = await request<{ data: StudioData; updatedAt: string; alreadyImported: boolean }>(`${API}/${encodeURIComponent(selected.id)}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, confirmed: true, expectedUpdatedAt: selected.updated_at }),
      });
      onImported(payload.data, payload.updatedAt);
      if (mounted.current) {
        select({ ...selected, draft, status: 'imported', imported_at: payload.updatedAt });
        setMessage(payload.alreadyImported ? 'This invoice was already imported. No duplicate stock was added.' : 'Delivery added to inventory and saved to the database. Existing stock and its costs have been kept separately.');
      }
    } catch (reason) { showError(reason); } finally { finish(); }
  }

  return (
    <section className={styles.root} aria-labelledby={`${inputId}-heading`}>
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>New delivery</p>
          <h3 id={`${inputId}-heading`}>Add stock from a supplier invoice</h3>
          <p>Upload a photo, check the details, then add the delivery to your inventory in one go.</p>
        </div>
        <div className={styles.upload}>
          <label htmlFor={inputId}>Supplier invoice photo</label>
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={locked} aria-describedby={`${inputId}-privacy`} />
          <small>JPG, PNG or WebP · up to 3 MB after preparation</small>
        </div>
      </div>
      <p id={`${inputId}-privacy`} className={styles.muted}>The photo is sent to an AI reader and stored privately with your Studio invoice history. Cover bank details before uploading. Large photos are resized on this device; your original is unchanged. Nothing is added to stock until you confirm.</p>
      {operation && <p className={styles.notice} role="status">{operation === 'upload' ? 'Preparing and reading the invoice… This can take a moment.' : operation === 'confirm' ? 'Saving this delivery to inventory…' : operation === 'save' ? 'Saving your review…' : 'Opening invoice…'}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}

      {selected && (
        <div className={styles.review}>
          <div className={styles.reviewHeading}>
            <div><span className={styles.badge}>{statusLabel[selected.status]}</span><h4>{selected.status === 'imported' ? 'Delivery record' : 'Review the invoice'}</h4><p className={styles.muted}>{selected.filename}</p></div>
            <a className={styles.secondary} href={`${API}/${encodeURIComponent(selected.id)}/image`} target="_blank" rel="noopener noreferrer">Open original photo ↗</a>
          </div>
          {selected.status === 'processing' && <div className={styles.notice}><p>The invoice is still being read. Inventory has not changed.</p><button type="button" disabled={locked} onClick={() => openInvoice(selected.id)}>Check reading status</button></div>}
          {selected.status === 'failed' && <div className={styles.error}><p>{selected.error_message || 'This invoice could not be read.'}</p><p>No inventory was changed. Check the photo is clear and complete, then upload it again. If the message mentions setup or a key, that connection must be configured first.</p></div>}
          {selected.status === 'imported' && <p className={styles.success}>This delivery has been added. The record is read-only to prevent accidental duplicate stock.</p>}
          {draft && (
            <>
              <fieldset className={styles.fields} disabled={locked || !editable}>
                <legend>Invoice details</legend>
                <div className={styles.headerGrid}>
                  <label>Supplier<input value={draft.supplier} maxLength={160} onChange={event => changeDraft({ supplier: event.target.value })} autoComplete="off" /></label>
                  <label>Invoice number<input value={draft.invoiceNumber} maxLength={100} onChange={event => changeDraft({ invoiceNumber: event.target.value })} autoComplete="off" /></label>
                  <label>Invoice date<input type="date" value={draft.invoiceDate} onChange={event => changeDraft({ invoiceDate: event.target.value })} /></label>
                  <label>Currency<select value={draft.currency} onChange={event => changeDraft({ currency: event.target.value })}>{draft.currency !== 'GBP' && <option value={draft.currency}>{draft.currency || 'Not read'}</option>}<option value="GBP">GBP (£)</option></select></label>
                </div>
              </fieldset>
              <details className={styles.companyDetails} open={!!draft.supplierDetails && Object.values(draft.supplierDetails).some(Boolean)}>
                <summary>Supplier company details</summary>
                <p className={styles.muted}>These details are saved with this invoice. Add anything the reader could not find on the photo.</p>
                <fieldset className={styles.fields} disabled={locked || !editable}>
                  <legend>Company and account information</legend>
                  <div className={styles.lineGrid}>
                    <label>Customer account number<input value={draft.supplierDetails?.accountNumber ?? ''} maxLength={100} onChange={event => changeSupplierDetails({ accountNumber: event.target.value })} /></label>
                    <label>Supplier VAT number<input value={draft.supplierDetails?.vatNumber ?? ''} maxLength={100} onChange={event => changeSupplierDetails({ vatNumber: event.target.value })} /></label>
                    <label>Supplier email<input type="email" value={draft.supplierDetails?.email ?? ''} maxLength={200} onChange={event => changeSupplierDetails({ email: event.target.value })} /></label>
                    <label>Supplier phone<input type="tel" value={draft.supplierDetails?.phone ?? ''} maxLength={100} onChange={event => changeSupplierDetails({ phone: event.target.value })} /></label>
                    <label className={styles.fullWidth}>Supplier address<textarea rows={3} value={draft.supplierDetails?.address ?? ''} maxLength={1000} onChange={event => changeSupplierDetails({ address: event.target.value })} /></label>
                  </div>
                </fieldset>
              </details>
              <div className={styles.notice}><strong>Check the units carefully.</strong> Pack size × packs gives the stock quantity. Foliage may be sold by the bunch, not the stem. Choose the actual stock unit for every included line. A new delivery batch will be created for each included line; older stock costs will not be overwritten.</div>
              {draft.warnings.length > 0 && <div className={styles.notice}><strong>The reader flagged these details:</strong><ul>{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
              <div className={styles.lines}>
                {draft.lines.map((line, index) => {
                  const quantity = line.packSize !== null && line.packs !== null ? line.packSize * line.packs : null;
                  const expected = quantity !== null && line.unitCost !== null ? quantity * line.unitCost : null;
                  const mismatch = expected !== null && line.lineTotal !== null && Math.round(expected * 100) !== Math.round(line.lineTotal * 100);
                  return (
                    <fieldset key={index} className={`${styles.line} ${line.include ? '' : styles.excluded}`} disabled={locked || !editable}>
                      <legend>Line {index + 1}</legend>
                      <div className={styles.lineHeading}>
                        <label className={styles.checkbox}><input type="checkbox" checked={line.include} onChange={event => changeLine(index, { include: event.target.checked })} />Add this line to stock</label>
                        <span className={styles.quantity}>{quantity === null ? 'Quantity needs checking' : `${quantity.toLocaleString('en-GB')} ${line.stockUnit === 'unknown' ? 'units — check unit type' : `${line.stockUnit}${quantity === 1 ? '' : 's'}`}`}</span>
                      </div>
                      <div className={styles.lineGrid}>
                        <label className={styles.wide}>Flower / item name<input value={line.name} maxLength={200} onChange={event => changeLine(index, { name: event.target.value })} /></label>
                        <label>Supplier code<input value={line.code} maxLength={100} onChange={event => changeLine(index, { code: event.target.value })} /></label>
                        <label>Colour<input value={line.colour} maxLength={100} onChange={event => changeLine(index, { colour: event.target.value })} /></label>
                        <label>Pack size<input type="number" inputMode="numeric" min="1" step="1" value={line.packSize ?? ''} onChange={event => changeLine(index, { packSize: readNumber(event.target.value) })} /></label>
                        <label>Number of packs<input type="number" inputMode="numeric" min="1" step="1" value={line.packs ?? ''} onChange={event => changeLine(index, { packs: readNumber(event.target.value) })} /></label>
                        <label>Cost per stock unit, ex VAT (£)<input type="number" inputMode="decimal" min="0" step="0.0001" value={line.unitCost ?? ''} onChange={event => changeLine(index, { unitCost: readNumber(event.target.value) })} /></label>
                        <label>Invoice line total, ex VAT (£)<input type="number" inputMode="decimal" min="0" step="0.01" value={line.lineTotal ?? ''} onChange={event => changeLine(index, { lineTotal: readNumber(event.target.value) })} /></label>
                        <label>Stock unit<select value={line.stockUnit} onChange={event => changeLine(index, { stockUnit: event.target.value as InvoiceStockUnit })}><option value="unknown">Check / choose a unit</option><option value="stem">Individual stem</option><option value="bunch">Bunch</option><option value="unit">Other item / unit</option></select></label>
                        <label className={styles.wide}>Notes / anything unclear<input value={line.note} maxLength={500} onChange={event => changeLine(index, { note: event.target.value })} /></label>
                      </div>
                      {mismatch && <p className={styles.lineWarning}>Pack size × packs × unit cost is {gbp(expected)}, but this line says {gbp(line.lineTotal)}. Check the quantities, units or price.</p>}
                      {!line.include && <p className={styles.muted}>Not added to stock. Its invoice line total still counts towards the invoice subtotal.</p>}
                      {editable && <button type="button" className={styles.removeLine} onClick={() => changeDraft({ lines: draft.lines.filter((_, position) => position !== index) })}>Remove line {index + 1} from review</button>}
                    </fieldset>
                  );
                })}
              </div>
              {editable && <button type="button" className={styles.secondary} disabled={locked || draft.lines.length >= 100} onClick={() => changeDraft({ lines: [...draft.lines, newLine()] })}>+ Add a missed line</button>}
              <fieldset className={styles.fields} disabled={locked || !editable}>
                <legend>Check the invoice totals</legend>
                <div className={styles.totalsGrid}>
                  <label>Other charges / discounts, ex VAT (£)<input type="number" inputMode="decimal" step="0.01" value={draft.otherCharges} onChange={event => changeDraft({ otherCharges: readNumber(event.target.value) ?? 0 })} /><small>Only amounts not already listed above. Enter a discount as a negative amount.</small></label>
                  <label>Invoice subtotal, ex VAT (£)<input type="number" inputMode="decimal" min="0" step="0.01" value={draft.subtotal ?? ''} onChange={event => changeDraft({ subtotal: readNumber(event.target.value) })} /></label>
                  <label>VAT on invoice (£)<input type="number" inputMode="decimal" min="0" step="0.01" value={draft.vat ?? ''} onChange={event => changeDraft({ vat: readNumber(event.target.value) })} /></label>
                  <label>Invoice total, inc VAT (£)<input type="number" inputMode="decimal" min="0" step="0.01" value={draft.total ?? ''} onChange={event => changeDraft({ total: readNumber(event.target.value) })} /></label>
                </div>
              </fieldset>
              <div className={styles.summary}>
                <div><span>New stock batches</span><strong>{included.length}</strong></div>
                <div><span>Calculated subtotal</span><strong>{gbp(calculatedNet)}</strong></div>
                <div><span>Invoice total</span><strong>{gbp(draft.total)}</strong></div>
              </div>
              <p className={styles.costNote}>Delivery charges, discounts and VAT are kept in the invoice record only. They are not spread across the stock unit costs shown in inventory.</p>
              {editable && (
                <div className={styles.confirm}>
                  {problems.length > 0 && <div className={styles.notice}><strong>Before adding to stock:</strong><ul>{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul></div>}
                  <label className={styles.checkbox}><input type="checkbox" checked={reviewed} disabled={locked} onChange={event => setReviewed(event.target.checked)} />I have received this stock and checked the invoice, quantities, stock units and prices against the original photo.</label>
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={locked || !reviewed || problems.length > 0} onClick={confirmImport}>Confirm &amp; add to inventory</button>
                    <button type="button" className={styles.secondary} disabled={locked || !dirty} onClick={saveReview}>Save review for later</button>
                    {dirty && <span className={styles.muted}>Unsaved review changes</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <details className={styles.history} open>
        <summary>Supplier invoice library{invoices.length > 0 ? ` (${invoices.length}${hasMore ? '+' : ''})` : ''}</summary>
        <div className={styles.historyHeading}><p className={styles.muted}>Invoices are grouped by supplier. Open one to see every line, the company details and the original photo.</p><button type="button" className={styles.secondary} disabled={locked || historyLoading} onClick={() => refreshHistory()}>Refresh</button></div>
        <label className={styles.librarySearch}>Find a supplier or invoice<input type="search" value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Supplier, invoice number or account number" /></label>
        {hasMore && <p className={styles.costNote}>Showing {invoices.length} loaded invoices. Load older invoices below to include them in searches, counts and supplier totals.</p>}
        {historyLoading && <p role="status">Loading supplier invoices…</p>}
        {historyError && <p className={styles.error} role="alert">{historyError}</p>}
        {!historyLoading && !historyError && invoices.length === 0 && <p className={styles.muted}>No supplier invoices uploaded yet.</p>}
        {!historyLoading && invoices.length > 0 && visibleGroups.length === 0 && <p className={styles.muted}>No matches in the loaded invoices. Try another name or number{hasMore ? ', or load older invoices below' : ''}.</p>}
        <div className={styles.supplierLibrary}>
          {visibleGroups.map(group => {
            const details = group.records.find(invoice => invoice.draft?.supplierDetails && Object.values(invoice.draft.supplierDetails).some(Boolean))?.draft?.supplierDetails;
            const importedTotal = group.records.reduce((sum, invoice) => invoice.status === 'imported' && invoice.draft?.currency === 'GBP' && invoice.draft.total !== null ? sum + invoice.draft.total : sum, 0);
            return (
              <section key={group.key} className={styles.supplierCard} aria-label={`${group.name} invoices`}>
                <div className={styles.supplierHeading}>
                  <div><h4>{group.name}</h4><p className={styles.muted}>{group.records.length} {hasMore ? 'loaded' : 'saved'} invoice{group.records.length === 1 ? '' : 's'}{query ? ` · ${group.matches.length} matching` : ''}</p></div>
                  <div className={styles.supplierTotal}><span>Imported invoice total, inc VAT</span><strong>{gbp(importedTotal)}</strong></div>
                </div>
                {details && <details className={styles.supplierContact}><summary>Company details from latest available invoice</summary><dl>{details.accountNumber && <div><dt>Account</dt><dd>{details.accountNumber}</dd></div>}{details.vatNumber && <div><dt>VAT number</dt><dd>{details.vatNumber}</dd></div>}{details.email && <div><dt>Email</dt><dd>{details.email}</dd></div>}{details.phone && <div><dt>Phone</dt><dd>{details.phone}</dd></div>}{details.address && <div className={styles.fullWidth}><dt>Address</dt><dd>{details.address}</dd></div>}</dl></details>}
                <div className={styles.historyList}>
                  {group.matches.map(invoice => <button type="button" key={invoice.id} className={`${styles.historyItem} ${selected?.id === invoice.id ? styles.selected : ''}`} disabled={locked} onClick={() => openInvoice(invoice.id)} aria-pressed={selected?.id === invoice.id}><span><strong>{invoice.draft?.invoiceNumber ? `Invoice ${invoice.draft.invoiceNumber}` : invoice.filename}</strong><small>{invoice.draft?.invoiceDate ? `Dated ${new Date(`${invoice.draft.invoiceDate}T12:00:00`).toLocaleDateString('en-GB')}` : `Uploaded ${new Date(invoice.created_at).toLocaleDateString('en-GB')}`} · {invoice.draft?.lines.length ?? 0} line{invoice.draft?.lines.length === 1 ? '' : 's'}</small></span><span className={styles.invoiceMeta}><strong>{invoice.draft?.currency === 'GBP' ? gbp(invoice.draft.total) : invoice.draft?.currency || 'Total not read'}</strong><span className={styles.badge}>{statusLabel[invoice.status]}</span></span></button>)}
                </div>
              </section>
            );
          })}
        </div>
        {hasMore && <button type="button" className={styles.loadMore} disabled={locked || historyLoading} onClick={() => refreshHistory(true)}>Load older invoices</button>}
      </details>
    </section>
  );
}
