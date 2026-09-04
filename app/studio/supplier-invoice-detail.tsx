import type { Ref } from 'react';
import type { InvoiceStockUnit, SupplierInvoiceRecord } from '@/lib/supplier-invoices';
import styles from './supplier-invoice-import.module.css';

type Props = {
  invoice: SupplierInvoiceRecord;
  onBack: () => void;
  titleRef?: Ref<HTMLHeadingElement>;
  loading?: boolean;
};

function money(value: number | null, currency: string, unitPrice = false) {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  const amount = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: unitPrice ? 4 : 2 });
  if (!/^[A-Z]{3}$/.test(currency)) return `${amount.format(value)} (currency not recorded)`;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: unitPrice ? 4 : 2 }).format(value);
}

function date(value: string | null) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(parsed);
}

function quantity(value: number | null) {
  return value === null || !Number.isFinite(value) ? 'Not recorded' : value.toLocaleString('en-GB');
}

function unitName(unit: InvoiceStockUnit, count: number | null) {
  if (unit === 'unknown') return 'units (type not recorded)';
  if (count === 1) return unit;
  return unit === 'bunch' ? 'bunches' : `${unit}s`;
}

// A purchase snapshot, deliberately independent of remaining stock or today's prices.
export default function SupplierInvoiceDetail({ invoice, onBack, titleRef, loading = false }: Props) {
  const draft = invoice.draft;
  const details = draft?.supplierDetails;
  const headingId = `invoice-${invoice.id}-title`;
  const currency = draft?.currency ?? '';
  const lineSum = draft?.lines.length && draft.lines.every(line => line.lineTotal !== null && Number.isFinite(line.lineTotal))
    ? draft.lines.reduce((sum, line) => sum + Math.round(line.lineTotal! * 100), 0) / 100 : null;

  return (
    <section className={styles.invoiceDetail} aria-labelledby={headingId}>
      <button type="button" className={styles.secondary} disabled={loading} onClick={onBack}>← Back to invoice library</button>
      <header className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>Supplier invoice history</p>
          <h3 id={headingId} ref={titleRef} tabIndex={-1}>{draft?.invoiceNumber ? `Invoice ${draft.invoiceNumber}` : 'Saved invoice'}</h3>
          <p className={styles.detailSupplier}>{draft?.supplier || 'Supplier not recorded'}</p>
        </div>
        <span className={styles.badge}>Saved purchase record</span>
      </header>
      <p className={styles.notice}>These are the original quantities and prices saved with this invoice. Using, wasting or removing stock does not change this record. You can return here to check past purchases and compare supplier prices.</p>

      {!draft ? loading ? <p className={styles.notice} role="status">Loading the saved invoice breakdown…</p> : <p className={styles.error} role="alert">The saved item breakdown could not be loaded. Return to the library and open the invoice again.</p> : <>
        <dl className={styles.detailFacts}>
          <div><dt>Invoice date</dt><dd>{date(draft.invoiceDate)}</dd></div>
          <div><dt>Customer account</dt><dd>{details?.accountNumber || 'Not recorded'}</dd></div>
          <div><dt>Added to inventory</dt><dd>{date(invoice.imported_at)}</dd></div>
          <div><dt>Supplier VAT number</dt><dd>{details?.vatNumber || 'Not recorded'}</dd></div>
          {details?.email && <div><dt>Supplier email</dt><dd>{details.email}</dd></div>}
          {details?.phone && <div><dt>Supplier phone</dt><dd>{details.phone}</dd></div>}
          {details?.address && <div className={styles.fullWidth}><dt>Supplier address</dt><dd>{details.address}</dd></div>}
        </dl>

        <div className={styles.detailItemsHeading}>
          <h4>Items on this invoice <span className={styles.badge}>{draft.lines.length}</span></h4>
          <p className={styles.muted}>Original purchase quantities · prices exclude VAT · {currency || 'Currency not recorded'}</p>
        </div>
        <ol className={styles.detailLines}>
          {draft.lines.map((line, index) => {
            const bought = line.packSize !== null && line.packs !== null ? line.packSize * line.packs : null;
            return <li key={index} className={styles.detailLine}>
              <div className={styles.lineIdentity}>
                <h5><span className={styles.lineNumber}>{String(index + 1).padStart(2, '0')}</span>{line.name || 'Unnamed item'}</h5>
                {(line.code || line.colour) && <p className={styles.muted}>{line.code ? `Code: ${line.code}` : ''}{line.code && line.colour ? ' · ' : ''}{line.colour}</p>}
                {!line.include && <p className={styles.nonStockNote}>Invoice-only line · not added to flower stock</p>}
              </div>
              <dl className={styles.lineNumbers}>
                <div><dt>Pack size</dt><dd>{quantity(line.packSize)}</dd></div>
                <div><dt>Packs</dt><dd>{quantity(line.packs)}</dd></div>
                <div><dt>Quantity bought</dt><dd>{quantity(bought)}{bought !== null && <small>{unitName(line.stockUnit, bought)}</small>}</dd></div>
                <div><dt>Unit price, ex VAT</dt><dd>{money(line.unitCost, currency, true)}<small>{line.stockUnit === 'unknown' ? 'Unit type not recorded' : `per ${line.stockUnit}`}</small></dd></div>
                <div className={styles.lineAmount}><dt>Line total, ex VAT</dt><dd>{money(line.lineTotal, currency)}</dd></div>
              </dl>
              {line.note && <p className={styles.detailLineNote}>{line.note}</p>}
            </li>;
          })}
        </ol>
        {draft.lines.length === 0 && <p className={styles.notice}>No item lines have been saved for this invoice.</p>}

        <div className={styles.detailFooter}>
          <p className={styles.muted}>All invoice lines are kept here, including materials and items not added to flower stock. Invoice charges, discounts and VAT are shown separately; they do not change the recorded unit prices.</p>
          <dl className={styles.detailTotals}>
            <div><dt>Items total, ex VAT</dt><dd>{money(lineSum, currency)}</dd></div>
            <div><dt>Other charges / discounts</dt><dd>{money(draft.otherCharges, currency)}</dd></div>
            <div><dt>Subtotal, ex VAT</dt><dd>{money(draft.subtotal, currency)}</dd></div>
            <div><dt>VAT</dt><dd>{money(draft.vat, currency)}</dd></div>
            <div className={styles.grandTotal}><dt>Invoice total, inc VAT</dt><dd>{money(draft.total, currency)}</dd></div>
          </dl>
        </div>
        {draft.warnings.length > 0 && <details className={styles.companyDetails}><summary>Saved invoice notes ({draft.warnings.length})</summary><ul>{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      </>}

      <details className={styles.originalReference}>
        <summary>Original photo (optional reference)</summary>
        <p className={styles.muted}>{invoice.filename}</p>
        <a className={styles.secondary} href={`/api/studio/supplier-invoices/${encodeURIComponent(invoice.id)}/image`} target="_blank" rel="noopener noreferrer">Open original photo in a new tab ↗</a>
      </details>
      <button type="button" className={styles.secondary} disabled={loading} onClick={onBack}>← Back to invoice library</button>
    </section>
  );
}
