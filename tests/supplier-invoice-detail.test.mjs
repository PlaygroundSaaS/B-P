import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);

async function loadTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name.endsWith('.module.css')
    ? { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }
    : require(name);
  new Function('module', 'exports', 'require', compiled)(module, module.exports, localRequire);
  return module.exports;
}

const { default: SupplierInvoiceDetail } = await loadTypeScript('../app/studio/supplier-invoice-detail.tsx');
const { toInventoryBatches } = await loadTypeScript('../lib/supplier-invoice-validation.ts');

function sample() {
  // Anonymised purchase record: two ribbon lines are retained on the invoice,
  // even though they are intentionally excluded from flower-stock import.
  const lines = [
    ['FOL-01', 'Example greenery A', 1, 1, 6.50, 6.50, 'unit', true],
    ['FLR-02', 'Example purple flower B', 10, 2, 4.50, 90.00, 'stem', true],
    ['MAT-03', 'Example white ribbon, 10 metre roll', 1, 1, 3.00, 3.00, 'unit', false],
    ['MAT-04', 'Example green ribbon, 10 metre roll', 1, 1, 3.00, 3.00, 'unit', false],
    ['FLR-05', 'Example white flower C', 1, 5, 0.75, 3.75, 'stem', true],
    ['FOL-06', 'Example greenery D', 1, 1, 7.50, 7.50, 'unit', true],
    ['FOL-07', 'Example foliage bunch E', 1, 1, 6.50, 6.50, 'bunch', true],
    ['FLR-08', 'Example white flower F', 1, 20, 1.20, 24.00, 'stem', true],
  ];
  return {
    id: '00000000-0000-4000-8000-000000000123',
    status: 'imported',
    filename: 'example-supplier-invoice.jpg',
    created_at: '2025-06-15T09:00:00.000Z',
    updated_at: '2025-06-15T09:10:00.000Z',
    imported_at: '2025-06-15T09:10:00.000Z',
    error_message: null,
    draft: {
      supplier: 'Example Flower Supplier Ltd',
      supplierDetails: {
        accountNumber: 'EXAMPLE-ACCOUNT-01',
        address: '1 Example Lane\nExampletown',
        email: 'accounts@example.invalid',
        phone: '00000 000000',
        vatNumber: 'EXAMPLE-VAT-01',
      },
      invoiceNumber: 'EXAMPLE-INV-002',
      invoiceDate: '2025-06-15',
      currency: 'GBP',
      subtotal: 144.25,
      vat: 28.85,
      total: 173.10,
      otherCharges: 0,
      warnings: ['Ribbon rolls are recorded separately from flower stock.'],
      lines: lines.map(([code, name, packSize, packs, unitCost, lineTotal, stockUnit, include]) => ({
        code, name, colour: '', packSize, packs, unitCost, lineTotal, stockUnit, include,
        note: include ? '' : 'Kept in the materials price catalogue.',
      })),
    },
  };
}

function render(invoice) {
  const html = renderToStaticMarkup(createElement(SupplierInvoiceDetail, { invoice, onBack: () => {} }));
  const text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
  return { html, text };
}

test('invoice detail shows all original lines, including materials excluded from stock', () => {
  const invoice = sample();
  const { text } = render(invoice);
  for (const line of invoice.draft.lines) {
    assert.ok(text.includes(line.name), `Missing invoice item: ${line.name}`);
    assert.ok(text.includes(line.code), `Missing supplier code: ${line.code}`);
  }
  assert.match(text, /20\s+stems/i);
  assert.match(text, /1\s+bunch/i);
  assert.match(text, /£90\.00/);
  assert.match(text, /£144\.25/);
  assert.match(text, /£28\.85/);
  assert.match(text, /£173\.10/);
  assert.match(text, /materials price catalogue/i);
});

test('original detail stays identical when separate stock batches are consumed, repriced or deleted', () => {
  const invoice = sample();
  const original = structuredClone(invoice);
  const before = render(invoice).html;
  const batches = toInventoryBatches(invoice.draft, invoice.id);
  assert.equal(batches.length, 6);
  for (const batch of batches) {
    batch.stemsRemaining = 0;
    batch.stemsPurchased += 100;
    batch.costPerStem = 99.99;
  }
  batches.splice(0, batches.length);
  assert.deepEqual(invoice, original);
  assert.equal(render(invoice).html, before);
});

test('supplier, account, invoice date and original company details remain visible', () => {
  const invoice = sample();
  const { text } = render(invoice);
  for (const expected of [
    invoice.draft.supplier, invoice.draft.invoiceNumber,
    ...Object.values(invoice.draft.supplierDetails).map(value => value.replace(/\s+/g, ' ')),
  ]) assert.ok(text.includes(expected), `Missing historical invoice detail: ${expected}`);
  assert.match(text, /15(?:\s+June?\s+|\/06\/)2025/);
});

test('read-only detail has no default photograph, editable controls or reimport action', () => {
  const { html, text } = render(sample());
  assert.doesNotMatch(html, /<(?:img|input|select|textarea|form)\b/i);
  assert.match(text, /back to (?:supplier )?invoices?/i);
  const buttonText = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)]
    .map(match => match[1].replace(/<[^>]*>/g, ' ')).join(' ');
  assert.doesNotMatch(buttonText, /(?:confirm|add to|reimport|save review|edit)/i);
});

test('sub-penny unit prices keep four decimals while line totals stay in pennies', () => {
  const invoice = sample();
  invoice.draft.lines = [{ ...invoice.draft.lines[0], packSize: 1, packs: 3, stockUnit: 'stem', unitCost: 0.3333, lineTotal: 1 }];
  invoice.draft.subtotal = 1;
  invoice.draft.vat = 0;
  invoice.draft.total = 1;
  const { text } = render(invoice);
  assert.match(text, /£0\.3333/);
  assert.match(text, /£1\.00(?!\d)/);
  assert.match(text, /£0\.00(?!\d)/);
});

test('zero values are displayed as zero and missing quantities or prices are never invented', () => {
  const invoice = sample();
  invoice.draft.lines = [
    { ...invoice.draft.lines[0], name: 'Complimentary example stem', packSize: 1, packs: 1, unitCost: 0, lineTotal: 0 },
    { ...invoice.draft.lines[1], name: 'Incomplete saved example', packSize: null, packs: null, unitCost: null, lineTotal: null, stockUnit: 'unknown', include: false },
  ];
  invoice.draft.subtotal = null;
  invoice.draft.vat = null;
  invoice.draft.total = null;
  const { text } = render(invoice);
  assert.match(text, /£0\.00(?!\d)/);
  assert.match(text, /not recorded/i);
  assert.doesNotMatch(text, /NaN|Invalid Date|undefined|null/);
});

test('invoice-level discounts remain negative without changing the archived line prices', () => {
  const invoice = sample();
  invoice.draft.otherCharges = -5;
  invoice.draft.subtotal = 139.25;
  invoice.draft.vat = 27.85;
  invoice.draft.total = 167.10;
  const { text } = render(invoice);
  assert.match(text, /-£5\.00/);
  assert.match(text, /£139\.25/);
  assert.match(text, /£167\.10/);
  assert.match(text, /£90\.00/);
});

test('a receipt with no extracted draft renders a safe empty state and a way back', () => {
  const invoice = sample();
  invoice.draft = null;
  const { text, html } = render(invoice);
  assert.match(text, /back to (?:supplier )?invoices?/i);
  assert.match(text, /(?:no |not |unavailable|missing)/i);
  assert.doesNotMatch(text, /NaN|Invalid Date|undefined|null/);
  assert.doesNotMatch(html, /<img\b/i);
});
