import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Review highlights: the Studio picks a passage from a review to show in large type.
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
function load(path, mocks = {}) {
  const filename = resolve(root, path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(resolve(dirname(filename), name) + '.ts', mocks) : require(name));
  return module.exports;
}
const site = 'https://www.bramblesandpetals.co.uk';
const post = body => new Request(`${site}/api/studio/reviews`, { method: 'POST', headers: { 'content-type': 'application/json', origin: site }, body: JSON.stringify(body) });
const review = 'Jade listened to everything we wanted.\n\nThe flowers were   beyond anything we imagined and the whole day felt calm.';

test('a highlight must be copied word for word from the review', () => {
  const { validateHighlight } = load('lib/review-validation.ts');
  assert.equal(validateHighlight('The flowers were beyond anything we imagined', review), 'The flowers were beyond anything we imagined');
  assert.equal(validateHighlight('  “we wanted. The flowers”  ', review), 'we wanted. The flowers');
  for (const value of [null, undefined, '', '   ', '“”']) assert.equal(validateHighlight(value, review), null);
  assert.throws(() => validateHighlight('The flowers were perfect', review), /word for word/);
  assert.throws(() => validateHighlight('Jd', review), /between 3 and 280/);
  assert.throws(() => validateHighlight('x'.repeat(281), 'x'.repeat(400)), /between 3 and 280/);
  assert.throws(() => validateHighlight(42, review), /from the review text/);
});

function studioApi(row, onUpdate) {
  const chain = { eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: row, error: null }), select: () => row ? { ...chain, then: resolve => resolve({ data: [{ id: 'r' }], error: null }) } : chain };
  return load('app/api/studio/reviews/route.ts', {
    '@/lib/studio-auth': { hasStudioSession: async () => true },
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => ({ from: () => ({ select: () => chain, update: value => { onUpdate(value); return chain; } }) }) },
  });
}

test('the Studio saves, refuses and removes highlights', async () => {
  const updates = [];
  const api = studioApi({ review_text: review }, value => updates.push(value));
  let response = await api.POST(post({ action: 'highlight', id: 'r', highlight: 'the whole day felt calm' }));
  assert.equal(response.status, 200);
  assert.deepEqual(updates.pop(), { highlight: 'the whole day felt calm' });
  response = await api.POST(post({ action: 'highlight', id: 'r', highlight: 'Best florist ever' }));
  assert.equal(response.status, 400);
  assert.equal(updates.length, 0);
  response = await api.POST(post({ action: 'highlight', id: 'r', highlight: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(updates.pop(), { highlight: null });
});

test('unsubmitted invitations cannot be highlighted', async () => {
  const response = await studioApi(null, () => assert.fail('no update expected')).POST(post({ action: 'highlight', id: 'r', highlight: 'anything' }));
  assert.equal(response.status, 404);
});

// Before the highlight migration runs, the database rejects the highlight column.
const missingColumn = { code: '42703', message: 'column studio_reviews.highlight does not exist' };
function listApi(path, extraMocks = {}) {
  const selects = [];
  const chain = columns => { const result = columns.includes('highlight') ? { data: null, error: missingColumn } : { data: [{ id: 'r', review_text: review }], error: null }; const link = { eq: () => link, not: () => link, order: () => link, limit: () => link, then: resolve => resolve(result) }; return link; };
  const api = load(path, { ...extraMocks, '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => ({ from: () => ({ select: columns => { selects.push(columns); return chain(columns); } }) }) } });
  return { api, selects };
}

test('the website still shows reviews before the highlight column exists', async () => {
  const { api, selects } = listApi('app/api/reviews/route.ts');
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).reviews, [{ id: 'r', review_text: review }]);
  assert.equal(selects.length, 2);
  assert.ok(!selects[1].includes('highlight'));
});

test('the Studio still lists reviews before the highlight column exists', async () => {
  const { api } = listApi('app/api/studio/reviews/route.ts', { '@/lib/studio-auth': { hasStudioSession: async () => true } });
  assert.equal((await api.GET()).status, 200);
});

test('saving a highlight before the migration explains what is missing', async () => {
  const chain = { eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: { review_text: review }, error: null }), select: () => ({ then: resolve => resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'highlight' column of 'studio_reviews' in the schema cache" } }) }) };
  const api = load('app/api/studio/reviews/route.ts', {
    '@/lib/studio-auth': { hasStudioSession: async () => true },
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => ({ from: () => ({ select: () => chain, update: () => chain }) }) },
  });
  const response = await api.POST(post({ action: 'highlight', id: 'r', highlight: 'the whole day felt calm' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not switched on/);
});

test('other database errors are not mistaken for a missing highlight column', () => {
  const { isMissingHighlightColumn } = load('lib/review-validation.ts');
  assert.equal(isMissingHighlightColumn(missingColumn), true);
  assert.equal(isMissingHighlightColumn({ code: '42703', message: 'column studio_reviews.rating does not exist' }), false);
  assert.equal(isMissingHighlightColumn({ code: '57014', message: 'timeout' }), false);
  assert.equal(isMissingHighlightColumn(null), false);
});
