import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Review photos: clients attach up to three photos, the website shows them once the review is published.
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
const reviewId = 'b7178081-d43c-48e0-bcfb-096dad8eaaee';
const token = `${reviewId}.${'a'.repeat(43)}`;
const photoA = '0f8fad5b-d9cb-469f-a165-70867728950e', photoB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const bytes = (...start) => new Uint8Array([...start, ...new Array(24).fill(0)]);
const jpeg = () => new Blob([bytes(0xff, 0xd8, 0xff, 0xe0)], { type: 'image/jpeg' });

// A stand-in for the Supabase client that records what the routes ask of it.
function fakeDb(options = {}) {
  const log = { uploads: [], removed: [], updates: [], selects: [] };
  function chain(result, single = result) {
    const query = { then: (ok, fail) => Promise.resolve(result()).then(ok, fail), maybeSingle: async () => single(), select: () => query };
    for (const name of ['eq', 'is', 'gt', 'not', 'order', 'limit']) query[name] = () => query;
    return query;
  }
  const db = {
    from: () => ({
      select(columns) {
        log.selects.push(columns);
        return chain(
          () => options.missingPhotos && columns.includes('photos') ? { data: null, error: { code: '42703', message: 'column studio_reviews.photos does not exist' } } : { data: options.rows ?? [], error: null },
          () => ({ data: columns === 'id' ? (options.open === false ? null : { id: reviewId }) : options.review ?? null, error: null }));
      },
      update(values) { log.updates.push(values); return chain(() => ({ data: options.updated === false ? [] : [{ id: reviewId }], error: null })); },
    }),
    storage: { from: bucket => ({
      upload: async (path, body, { contentType }) => { if (options.uploadFails) return { error: { message: 'unavailable' } }; log.uploads.push({ bucket, path, contentType, size: body.length }); return { error: null }; },
      remove: async paths => { log.removed.push(...paths); return { error: null }; },
      download: async path => ({ data: new Blob(['photo'], { type: 'image/jpeg' }), error: null, path }),
    }) },
  };
  return { db, log };
}
const database = db => ({ STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => db });
const reviewsApi = db => load('app/api/reviews/route.ts', { '@/lib/studio-database': database(db) });

function submission(photos = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ token, name: 'J & A', message: 'Thoughtful flowers and a lovely experience.', occasion: 'Wedding', rating: '5', consent: 'true' })) form.set(key, value);
  for (const photo of photos) form.append('photo', photo, 'photo.jpg');
  return new Request(`${site}/api/reviews`, { method: 'POST', headers: { origin: site }, body: form });
}

test('photos are recognised by their contents, not their names', () => {
  const { reviewPhotoType } = load('lib/review-validation.ts');
  assert.equal(reviewPhotoType(bytes(0xff, 0xd8, 0xff, 0xe1)), 'image/jpeg');
  assert.equal(reviewPhotoType(bytes(137, 80, 78, 71, 13, 10, 26, 10)), 'image/png');
  assert.equal(reviewPhotoType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  for (const text of ['<svg xmlns="http://www.w3.org/2000/svg">', '%PDF-1.7 document', 'GIF89a..........', '\0\0\0\x18ftypheic....', 'short']) assert.equal(reviewPhotoType(new TextEncoder().encode(text)), null);
});

test('a review is saved with up to three photos in private storage', async () => {
  const { db, log } = fakeDb();
  const response = await reviewsApi(db).POST(submission([jpeg(), jpeg(), jpeg()]));
  assert.equal(response.status, 200);
  assert.equal(log.uploads.length, 3);
  const ids = log.uploads.map(upload => upload.path.split('/').pop());
  for (const upload of log.uploads) { assert.equal(upload.bucket, 'review-photos'); assert.equal(upload.contentType, 'image/jpeg'); assert.match(upload.path, new RegExp(`^test/${reviewId}/[0-9a-f-]{36}$`)); }
  assert.deepEqual(log.updates[0].photos, ids);
  assert.equal(log.updates[0].published, false);
});

test('more than three photos, or files that are not photos, are refused before anything is stored', async () => {
  for (const photos of [[jpeg(), jpeg(), jpeg(), jpeg()], [new Blob(['%PDF-1.7 not a photograph at all'])], [new Blob([bytes(0xff, 0xd8, 0xff), new Uint8Array(1_400_000)])]]) {
    const { db, log } = fakeDb();
    const response = await reviewsApi(db).POST(submission(photos));
    assert.equal(response.status, 400);
    assert.equal(log.uploads.length + log.updates.length, 0);
  }
});

test('photos are not stored for an invitation that has been used or withdrawn', async () => {
  const { db, log } = fakeDb({ open: false });
  const response = await reviewsApi(db).POST(submission([jpeg()]));
  assert.equal(response.status, 409);
  assert.equal(log.uploads.length, 0);
});

test('stored photos are removed again if the review cannot be saved', async () => {
  let { db, log } = fakeDb({ updated: false });
  let response = await reviewsApi(db).POST(submission([jpeg(), jpeg()]));
  assert.equal(response.status, 409);
  assert.deepEqual(log.removed.sort(), log.uploads.map(upload => upload.path).sort());
  ({ db, log } = fakeDb({ uploadFails: true }));
  response = await reviewsApi(db).POST(submission([jpeg()]));
  assert.equal(response.status, 503);
  assert.equal(log.updates.length, 0);
});

test('reviews without photos never touch the photos column', async () => {
  const { db, log } = fakeDb();
  assert.equal((await reviewsApi(db).POST(submission())).status, 200);
  assert.equal('photos' in log.updates[0], false);
  const json = new Request(`${site}/api/reviews`, { method: 'POST', headers: { origin: site, 'content-type': 'application/json' }, body: JSON.stringify({ token, name: 'Sam', message: 'Beautiful flowers, thank you.', occasion: 'Other', rating: 4, consent: true }) });
  assert.equal((await reviewsApi(db).POST(json)).status, 200);
  assert.equal(log.uploads.length, 0);
});

test('reviews still load, without photos, until the database has the photos column', async () => {
  const { db, log } = fakeDb({ missingPhotos: true, rows: [{ id: reviewId, public_name: 'Sam' }] });
  const response = await reviewsApi(db).GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).reviews, [{ id: reviewId, public_name: 'Sam', photos: [] }]);
  assert.match(log.selects[0], /photos/);
  assert.doesNotMatch(log.selects[1], /photos/);
});

test('a photo is public only while its review is published; the Studio sees every photo', async () => {
  const photo = (review, session = false) => load('app/api/reviews/[id]/photos/[photo]/route.ts', { '@/lib/studio-database': database(fakeDb({ review }).db), '@/lib/studio-auth': { hasStudioSession: async () => session } });
  const get = (api, id = reviewId, file = photoA) => api.GET(new Request(`${site}/api/reviews/${id}/photos/${file}`), { params: Promise.resolve({ id, photo: file }) });
  const submitted = { submitted_at: '2026-09-27T10:00:00Z', photos: [photoA] };
  let response = await get(photo({ ...submitted, published: true }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /^public/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await get(photo({ ...submitted, published: false }))).status, 404);
  response = await get(photo({ ...submitted, published: false }, true));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await get(photo({ ...submitted, published: true }), reviewId, photoB)).status, 404);
  assert.equal((await get(photo({ ...submitted, published: true }), '../secret', photoA)).status, 404);
});

test('the Studio can remove a single photo from a review', async () => {
  const studio = db => load('app/api/studio/reviews/route.ts', { '@/lib/studio-database': database(db), '@/lib/studio-auth': { hasStudioSession: async () => true } });
  const post = body => new Request(`${site}/api/studio/reviews`, { method: 'POST', headers: { origin: site, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const { db, log } = fakeDb({ review: { photos: [photoA, photoB] } });
  let response = await studio(db).POST(post({ action: 'remove-photo', id: reviewId, photo: photoA }));
  assert.equal(response.status, 200);
  assert.deepEqual(log.updates, [{ photos: [photoB] }]);
  assert.deepEqual(log.removed, [`test/${reviewId}/${photoA}`]);
  response = await studio(db).POST(post({ action: 'remove-photo', id: reviewId, photo: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(response.status, 404);
  response = await studio(db).POST(post({ action: 'remove-photo', id: reviewId, photo: '../../other' }));
  assert.equal(response.status, 400);
  assert.equal(log.updates.length, 1);
});
