import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Tests for the September 2026 code-review fixes: rate limits, stricter origin
// checks, password-bound sessions, photo storage and review approval.
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
function load(path, mocks = {}) {
  const filename = resolve(root, path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(resolve(dirname(filename), name) + '.ts', mocks) : require(name));
  return module.exports;
}
async function withEnv(values, run) {
  const old = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) value === undefined ? delete process.env[key] : process.env[key] = value;
  try { return await run(); } finally { for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value; }
}
const site = 'https://www.bramblesandpetals.co.uk';
const json = (path, body, headers = { origin: site }) => new Request(`${site}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('writes without Origin or same-origin fetch metadata are refused; reads and browser writes are allowed', () => {
  const { requireSameOrigin } = load('lib/request-body.ts');
  assert.throws(() => requireSameOrigin(new Request(`${site}/api/enquiry`, { method: 'POST' })), /from the website/);
  assert.doesNotThrow(() => requireSameOrigin(new Request(`${site}/api/enquiry`, { method: 'POST', headers: { origin: site } })));
  assert.doesNotThrow(() => requireSameOrigin(new Request(`${site}/api/enquiry`, { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } })));
  assert.doesNotThrow(() => requireSameOrigin(new Request(`${site}/api/studio/supplier-invoices/x/image`)));
  assert.throws(() => requireSameOrigin(new Request(`${site}/api/enquiry`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })), /from the website/);
});

test('changing the Studio password signs out every existing session', async () => {
  await withEnv({ AUTH_SECRET: 'local-auth-test', STUDIO_PASSWORD: 'first-password' }, async () => {
    const token = load('lib/studio-auth.ts').createStudioSession();
    const withCookie = () => load('lib/studio-auth.ts', { 'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) } });
    assert.equal(await withCookie().hasStudioSession(), true);
    process.env.STUDIO_PASSWORD = 'second-password';
    assert.equal(await withCookie().hasStudioSession(), false);
  });
});

test('login is refused while rate limited and failed attempts are counted', async () => {
  await withEnv({ AUTH_SECRET: 'local-auth-test', STUDIO_PASSWORD: 'correct-password', STUDIO_USERNAME: 'jade' }, async () => {
    let allowed = true, failures = 0;
    const api = load('app/api/studio/login/route.ts', { '@/lib/rate-limit': { loginAllowed: async () => allowed, recordLoginFailure: async () => { failures++; } } });
    assert.equal((await api.POST(json('/api/studio/login', { username: 'jade', password: 'wrong' }))).status, 401);
    assert.equal(failures, 1);
    const ok = await api.POST(json('/api/studio/login', { username: 'jade', password: 'correct-password' }));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('set-cookie') || '', /bramble_petal_studio_session=/);
    assert.equal(failures, 1);
    allowed = false;
    const limited = await api.POST(json('/api/studio/login', { username: 'jade', password: 'correct-password' }));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('set-cookie'), null);
  });
});

test('rate limiter hashes visitor addresses and fails open if the database is unavailable', async () => {
  await withEnv({ AUTH_SECRET: 'local-auth-test' }, async () => {
    const calls = [];
    let reply = { data: true, error: null };
    const limiter = load('lib/rate-limit.ts', { './studio-database': { createStudioDatabaseClient: () => ({ rpc: async (name, args) => { calls.push({ name, ...args }); return reply; } }) } });
    const request = new Request(`${site}/api/enquiry`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } });
    assert.equal(await limiter.enquiryAllowed(request), true);
    assert.deepEqual(calls.map(c => c.p_bucket), ['enquiry', 'enquiry-all']);
    assert.ok(calls.every(c => !String(c.p_key).includes('203.0.113.9')));
    assert.match(calls[0].p_key, /^[a-f0-9]{64}$/);
    reply = { data: false, error: null };
    assert.equal(await limiter.loginAllowed(request), false);
    reply = { data: null, error: { code: 'PGRST202' } };
    const oldError = console.error; console.error = () => {};
    try { assert.equal(await limiter.loginAllowed(request), true); } finally { console.error = oldError; }
  });
});

test('Studio saves cannot add new inline photographs, while stored asset photos are accepted', () => {
  const { addsInlineImages, isStudioData } = load('lib/studio-validation.ts');
  const { emptyStudio } = load('lib/pricing.ts');
  const plan = (references, photoSrc = '') => ({ id: 'plan', clientName: 'Client', type: 'Wedding', eventDate: '2027-06-01', notes: '', finishedEstimate: null, createdAt: '2026-09-01T10:00:00Z', references, setupOptions: [{ id: 'option', title: 'Arch', description: '', quantity: 1, unitPrice: null, photoSrc, selected: true }] });
  const data = references => ({ ...emptyStudio(), plans: [plan(references)] });
  const old = { id: 'old', name: 'old.jpg', dataUrl: 'data:image/jpeg;base64,AAAA' };
  const stored = { id: 'b7178081-d43c-48e0-bcfb-096dad8eaaee', name: 'new.jpg', dataUrl: '/api/studio/assets/b7178081-d43c-48e0-bcfb-096dad8eaaee' };
  assert.equal(addsInlineImages(data([old]), data([old, stored])), false);
  assert.equal(addsInlineImages(data([old]), data([old, { ...old, id: 'new', dataUrl: 'data:image/jpeg;base64,BBBB' }])), true);
  assert.equal(isStudioData({ ...emptyStudio(), plans: [plan([stored], stored.dataUrl)] }), true);
});

test('a client photo over the plan allowance is refused before anything is stored', async () => {
  let uploads = 0;
  const references = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, name: 'photo.jpg', dataUrl: '/api/studio/assets/x', caption: '' }));
  const api = load('app/api/studio/assets/route.ts', {
    '@/lib/studio-auth': { hasStudioSession: async () => false },
    '@/lib/client-auth': { clientGrant: async () => ({ id: 'grant', plan_id: 'plan' }) },
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => ({ storage: { from: () => ({ upload: async () => { uploads++; return { error: null }; }, remove: async () => ({}) }) } }) },
    '@/lib/studio-command-server': { readWorkspace: async () => ({ data: { plans: [{ id: 'plan', references }] }, updatedAt: 'now' }), commandHash: () => 'x', commitWorkspace: async () => { throw Error('must not commit'); } },
  });
  const form = new FormData();
  form.append('file', new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0])], 'photo.jpg', { type: 'image/jpeg' }));
  const response = await api.POST(new Request(`${site}/api/studio/assets`, { method: 'POST', headers: { origin: site }, body: form }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /cannot accept more images/);
  assert.equal(uploads, 0);
});

test('submitted reviews wait for Studio approval before appearing on the website', async () => {
  let update;
  const chain = { eq: () => chain, is: () => chain, gt: () => chain, select: async () => ({ data: [{ id: 'review' }], error: null }) };
  const api = load('app/api/reviews/route.ts', {
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => ({ from: () => ({ update: value => { update = value; return chain; } }) }) },
  });
  const response = await api.POST(json('/api/reviews', { token: `b7178081-d43c-48e0-bcfb-096dad8eaaee.${'a'.repeat(43)}`, name: 'J & A', message: 'Thoughtful flowers and a lovely experience.', rating: 5, occasion: 'Wedding', consent: true }));
  assert.equal(response.status, 200);
  assert.equal(update.published, false);
  assert.match((await response.json()).message, /once it has been checked/);
});
