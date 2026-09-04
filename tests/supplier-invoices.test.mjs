import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/supplier-invoice-validation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateSupplierInvoice, toInventoryBatches } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const rawSample = [
  ['Example flower A', 10, 1, 1.50, 15.00, 'stem'],
  ['Example flower B', 10, 2, 1.30, 26.00, 'stem'],
  ['Example flower C', 25, 3, 1.60, 120.00, 'stem'],
  ['Example foliage D', 1, 2, 7.50, 15.00, 'unit'],
  ['Example foliage E', 1, 3, 6.50, 19.50, 'unit'],
  ['Example flower F', 10, 2, 1.65, 33.00, 'stem'],
  ['Example flower G', 5, 1, 7.50, 37.50, 'stem'],
  ['Example flower H', 5, 2, 5.50, 55.00, 'stem'],
  ['Example flower I', 10, 2, 1.20, 24.00, 'stem'],
  ['Example flower J', 10, 2, 1.40, 28.00, 'stem'],
];

function sample() {
  return {
    // Anonymised arithmetic fixture; foliage uses units rather than guessed stems/bunches.
    supplier: 'Example Flower Supplier Ltd', invoiceNumber: 'TEST-INV-001', invoiceDate: '2025-06-15', currency: 'GBP',
    supplierDetails: { accountNumber: 'TEST-ACCOUNT-001', address: '', email: '', phone: '', vatNumber: '' },
    subtotal: 373, vat: 74.60, total: 447.60, otherCharges: 0, warnings: [],
    lines: rawSample.map(([name, packSize, packs, unitCost, lineTotal, stockUnit]) => ({
      code: '', name, colour: '', packSize, packs, unitCost, lineTotal, stockUnit, include: true, note: '',
    })),
  };
}

function oneLine(overrides = {}) {
  const draft = sample();
  draft.lines = [{ ...draft.lines[0], packSize: 1, packs: 3, unitCost: 0.1, lineTotal: 0.3, ...overrides }];
  draft.subtotal = draft.lines[0].lineTotal;
  draft.vat = 0;
  draft.total = draft.subtotal;
  return draft;
}

test('anonymised fixture reconciles ten lines, 185 mixed stock units and £373 + £74.60 = £447.60', () => {
  const draft = sample();
  assert.deepEqual(validateSupplierInvoice(draft), []);
  const batches = toInventoryBatches(draft, 'sample-import');
  assert.equal(batches.length, 10);
  assert.equal(batches.reduce((sum, item) => sum + item.stemsPurchased, 0), 185);
  assert.equal(batches[2].stemsPurchased, 75);
  assert.equal(batches[6].stemsPurchased, 5);
  assert.equal(batches[6].costPerStem, 7.5);
  assert.equal(Math.round(batches.reduce((sum, item) => sum + item.stemsPurchased * item.costPerStem, 0) * 100), 37300);
});

test('new batches are deterministic, retain ex-VAT cost and metadata, and never mutate the draft', () => {
  const draft = sample();
  const original = structuredClone(draft);
  const batches = toInventoryBatches(draft, 'delivery-1');
  assert.deepEqual(draft, original);
  assert.deepEqual(batches, toInventoryBatches(draft, 'delivery-1'));
  assert.notEqual(batches[0].id, toInventoryBatches(draft, 'delivery-2')[0].id);
  assert.equal(batches[0].id, 'delivery-1:0');
  assert.equal(batches[0].supplierInvoiceId, 'delivery-1');
  assert.equal(batches[0].receivedAt, '2025-06-15');
  assert.equal(batches[0].stemsPurchased, batches[0].stemsRemaining);
  assert.equal(batches[3].name, 'Example foliage D (unit)');
  assert.equal(batches[0].costPerStem, 1.50);
  batches[0].stemsRemaining = 0;
  assert.equal(toInventoryBatches(draft, 'delivery-1')[0].stemsRemaining, 10);
});

test('two equally named invoice lines remain separate new delivery batches', () => {
  const draft = sample();
  draft.lines[1].name = draft.lines[0].name;
  const batches = toInventoryBatches(draft, 'test');
  assert.equal(batches.length, 10);
  assert.equal(batches[0].name, batches[1].name);
  assert.notEqual(batches[0].id, batches[1].id);
  assert.equal(batches[0].costPerStem, 1.5);
  assert.equal(batches[1].costPerStem, 1.3);
});

test('missing supplier or invoice number blocks import', () => {
  for (const key of ['supplier', 'invoiceNumber']) {
    const draft = sample(); draft[key] = '  ';
    assert.ok(validateSupplierInvoice(draft).length > 0);
    assert.throws(() => toInventoryBatches(draft, 'test'));
  }
});

test('unknown units need review for included lines, but can remain unknown for excluded lines', () => {
  const draft = sample(); draft.lines[0].stockUnit = 'unknown';
  assert.match(validateSupplierInvoice(draft).join(' '), /confirm whether/);
  draft.lines[0].include = false;
  assert.deepEqual(validateSupplierInvoice(draft), []);
  const batches = toInventoryBatches(draft, 'test');
  assert.equal(batches.length, 9);
  assert.equal(batches[0].id, 'test:1');
  draft.lines[1].stockUnit = 'unit';
  assert.match(toInventoryBatches(draft, 'test')[0].name, / \(unit\)$/);
  draft.lines[1].stockUnit = 'bunch';
  assert.match(toInventoryBatches(draft, 'test')[0].name, / \(bunch\)$/);
});

test('supplier details are optional but must contain five bounded strings when present', () => {
  const omitted = sample(); delete omitted.supplierDetails;
  assert.deepEqual(validateSupplierInvoice(omitted), []);
  assert.deepEqual(validateSupplierInvoice(sample()), []);
  for (const value of [null, [], '', 42, true, {}]) {
    const draft = sample(); draft.supplierDetails = value;
    assert.ok(validateSupplierInvoice(draft).length > 0);
  }
  for (const [field, limit] of [['accountNumber', 100], ['address', 1000], ['email', 200], ['phone', 100], ['vatNumber', 100]]) {
    const boundary = sample(); boundary.supplierDetails[field] = 'x'.repeat(limit);
    assert.deepEqual(validateSupplierInvoice(boundary), []);
    for (const value of ['x'.repeat(limit + 1), null, 42, [], {}]) {
      const draft = sample(); draft.supplierDetails[field] = value;
      assert.ok(validateSupplierInvoice(draft).length > 0);
    }
    const missing = sample(); delete missing.supplierDetails[field];
    assert.ok(validateSupplierInvoice(missing).length > 0);
  }
});

test('exclusion affects stock only, never invoice accounting', () => {
  const draft = sample(); draft.lines[0].include = false;
  assert.deepEqual(validateSupplierInvoice(draft), []);
  draft.subtotal -= 15; draft.total -= 15;
  assert.match(validateSupplierInvoice(draft).join(' '), /including lines excluded/);
});

test('other charges reconcile without becoming inventory', () => {
  const draft = sample(); draft.otherCharges = 5; draft.subtotal = 378; draft.vat = 75.6; draft.total = 453.6;
  assert.deepEqual(validateSupplierInvoice(draft), []);
  assert.equal(toInventoryBatches(draft, 'test').length, 10);
});

test('bounded invoice-level discounts reconcile while stock costs and line totals stay non-negative', () => {
  const draft = sample(); draft.otherCharges = -5; draft.subtotal = 368; draft.vat = 73.6; draft.total = 441.6;
  assert.deepEqual(validateSupplierInvoice(draft), []);
  assert.equal(toInventoryBatches(draft, 'test')[0].costPerStem, 1.5);
  draft.total = 447.6;
  assert.match(validateSupplierInvoice(draft).join(' '), /must match the total payable/);
  for (const amount of [-1_000_000.01, 1_000_000.01, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -1.001]) {
    const invalid = sample(); invalid.otherCharges = amount;
    assert.match(validateSupplierInvoice(invalid).join(' '), /Other charges or invoice-level discounts/);
  }
});

test('integer-scaled rounding handles floating point and sub-penny unit costs', () => {
  assert.deepEqual(validateSupplierInvoice(oneLine()), []);
  assert.deepEqual(validateSupplierInvoice(oneLine({ packs: 1, unitCost: 1.005, lineTotal: 1.01 })), []);
  assert.deepEqual(validateSupplierInvoice(oneLine({ packs: 3, unitCost: 0.3333, lineTotal: 1 })), []);
  assert.ok(validateSupplierInvoice(oneLine({ unitCost: 0.33333, lineTotal: 1 })).length > 0);
  assert.ok(validateSupplierInvoice(oneLine({ lineTotal: 0.301 })).length > 0);
});

test('zero-cost complimentary stock is allowed; negative costs, quantities and credits are blocked', () => {
  assert.deepEqual(validateSupplierInvoice(oneLine({ unitCost: 0, lineTotal: 0 })), []);
  for (const field of ['unitCost', 'lineTotal', 'packSize', 'packs']) {
    assert.ok(validateSupplierInvoice(oneLine({ [field]: -1 })).length > 0);
  }
  for (const field of ['subtotal', 'vat', 'total']) {
    const draft = sample(); draft[field] = -1;
    assert.ok(validateSupplierInvoice(draft).length > 0);
  }
});

test('non-finite, numeric strings, nulls and invalid runtime fields are never coerced', () => {
  for (const value of [NaN, Infinity, -Infinity, '1', null, undefined, {}, []]) {
    for (const field of ['unitCost', 'lineTotal', 'packSize', 'packs']) {
      assert.ok(validateSupplierInvoice(oneLine({ [field]: value })).length > 0);
    }
    for (const field of ['subtotal', 'vat', 'total', 'otherCharges']) {
      const draft = sample(); draft[field] = value;
      assert.ok(validateSupplierInvoice(draft).length > 0);
    }
  }
  for (const invalid of [null, false, 1, 'invoice', []]) assert.ok(validateSupplierInvoice(invalid).length > 0);
  const draft = sample(); draft.lines = [null];
  assert.ok(validateSupplierInvoice(draft).length > 0);
  draft.lines = [{ ...sample().lines[0], include: 'true', stockUnit: 'box', name: 12, note: {} }];
  assert.ok(validateSupplierInvoice(draft).length >= 4);
});

test('positive integer pack quantities and sensible limits are required', () => {
  for (const value of [0, 0.5, 100001, Number.MAX_SAFE_INTEGER]) {
    assert.ok(validateSupplierInvoice(oneLine({ packs: value })).length > 0);
    assert.ok(validateSupplierInvoice(oneLine({ packSize: value })).length > 0);
  }
  assert.ok(validateSupplierInvoice(oneLine({ packSize: 100000, packs: 100000, unitCost: 0, lineTotal: 0 })).length > 0);
  assert.ok(validateSupplierInvoice(oneLine({ unitCost: 1000001, lineTotal: 1000001 })).length > 0);
});

test('invoice dates must be real ISO calendar dates and currency GBP', () => {
  for (const value of ['03/09/26', '2026-02-30', '2025-02-29', '2026-13-01', '2026-09-03T00:00:00Z', '0000-01-01', '', 20260903]) {
    const draft = sample(); draft.invoiceDate = value;
    assert.match(validateSupplierInvoice(draft).join(' '), /real invoice date/);
  }
  const leap = sample(); leap.invoiceDate = '2024-02-29';
  assert.deepEqual(validateSupplierInvoice(leap), []);
  for (const currency of ['USD', 'gbp', '', null]) {
    const draft = sample(); draft.currency = currency;
    assert.match(validateSupplierInvoice(draft).join(' '), /Only GBP/);
  }
});

test('mismatched line arithmetic, subtotal and total are blocked independently', () => {
  const line = sample(); line.lines[0].unitCost = 2;
  assert.match(validateSupplierInvoice(line).join(' '), /does not match the line total/);
  const subtotal = sample(); subtotal.subtotal = 400;
  assert.match(validateSupplierInvoice(subtotal).join(' '), /must match the invoice subtotal/);
  const total = sample(); total.total = 400;
  assert.match(validateSupplierInvoice(total).join(' '), /must match the total payable/);
});

test('metadata size, line count, warning types and selection bounds are enforced', () => {
  for (const [field, max] of [['supplier', 200], ['invoiceNumber', 100]]) {
    const draft = sample(); draft[field] = 'x'.repeat(max + 1);
    assert.ok(validateSupplierInvoice(draft).length > 0);
  }
  for (const [field, max] of [['name', 200], ['colour', 100], ['code', 100], ['note', 1000]]) {
    assert.ok(validateSupplierInvoice(oneLine({ [field]: 'x'.repeat(max + 1) })).length > 0);
  }
  for (const warnings of [null, 'warning', [1], ['x'.repeat(1001)], Array(101).fill('warning')]) {
    const draft = sample(); draft.warnings = warnings;
    assert.ok(validateSupplierInvoice(draft).length > 0);
  }
  for (const lines of [[], Array(101).fill(sample().lines[0]), 'lines']) {
    const draft = sample(); draft.lines = lines;
    assert.match(validateSupplierInvoice(draft).join(' '), /between 1 and 100/);
  }
  const none = sample(); none.lines.forEach((line) => { line.include = false; });
  assert.match(validateSupplierInvoice(none).join(' '), /Select at least one/);
  for (const id of ['', 'bad id', '../test', 'x'.repeat(129), null]) assert.throws(() => toInventoryBatches(sample(), id));
});

