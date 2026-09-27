import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Website photos: Jade adds, removes and arranges the website galleries in the Studio.
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
const uploadA = '/site-photos/11111111-2222-4333-8444-555555555555';
const uploadB = '/site-photos/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const idOf = src => src.split('/').pop();
const photos = load('lib/site-photos.ts');

test('a saved gallery keeps built-in details and fills in missing descriptions', () => {
  const saved = photos.validateGalleryPhotos('weddings', [
    { src: uploadA, alt: '  Blush roses\n and dahlias ', width: 1500, height: 2000 },
    { src: '/assets/weddings/flower-girl-crown.webp', alt: '', width: 1, height: 1, label: 'Changed' },
    { src: uploadB, width: 0, height: 900 },
  ]);
  assert.deepEqual(saved[0], { src: uploadA, alt: 'Blush roses and dahlias', width: 1500, height: 2000 });
  assert.equal(saved[1].label, 'The smallest, sweetest details');
  assert.equal(saved[1].width, 953);
  assert.match(saved[1].alt, /flower girl/);
  assert.deepEqual(saved[2], { src: uploadB, alt: photos.DEFAULT_PHOTO_ALT });
});

test('a gallery refuses photos from elsewhere, repeats and too many photos', () => {
  const check = (key, list) => () => photos.validateGalleryPhotos(key, list);
  assert.throws(check('home', [{ src: '/assets/bouquet-04.jpg', alt: '' }]), /not from the website or the Studio/);
  assert.throws(check('home', [{ src: 'https://example.com/photo.jpg' }]), /not from the website/);
  assert.throws(check('home', [{ src: '/site-photos/../../secret' }]), /not from the website/);
  assert.throws(check('home', [{ src: uploadA }, { src: uploadA }]), /appears twice/);
  assert.throws(check('home', Array.from({ length: 9 }, (_, i) => ({ src: `/site-photos/11111111-2222-4333-8444-55555555555${i}` }))), /up to 8 photos/);
  assert.throws(check('home', [{ src: uploadA, alt: 'x'.repeat(201) }]), /under 200 characters/);
  assert.throws(check('home', 'photos'), /list of photos/);
  assert.deepEqual(photos.validateGalleryPhotos('home', []), []);
});

test('the removed bouquet is not offered back and the homepage starts with three photos', () => {
  assert.equal(photos.BUILT_IN_PHOTOS.some(photo => photo.src.includes('bouquet-04')), false);
  assert.equal(photos.SITE_GALLERIES.home.defaults.length, 3);
  assert.equal(new Set(photos.BUILT_IN_PHOTOS.map(photo => photo.src)).size, photos.BUILT_IN_PHOTOS.length);
});

test('homepage strip image sizes follow the rows of four and pairs on phones', () => {
  assert.equal(photos.stripPhotoSizes(0, 3), '(max-width: 700px) 50vw, 34vw');
  assert.equal(photos.stripPhotoSizes(2, 3), '(max-width: 700px) 100vw, 34vw');
  assert.equal(photos.stripPhotoSizes(3, 6), '(max-width: 700px) 50vw, 25vw');
  assert.equal(photos.stripPhotoSizes(5, 6), '(max-width: 700px) 50vw, 50vw');
  assert.equal(photos.stripPhotoSizes(4, 5), '(max-width: 700px) 100vw, 100vw');
});

// A small stand-in for the Supabase client: one gallery table and one storage folder.
function fakeDatabase({ rows = [], files = {}, failRead = null } = {}) {
  const state = { rows: rows.map(row => ({ workspace_key: 'test', ...row })), files: { ...files }, removed: [], uploaded: [] };
  const query = (run) => { const filters = []; const chain = { eq: (column, value) => { filters.push([column, value]); return chain; }, select: () => chain, then: (done, fail) => Promise.resolve(run(filters)).then(done, fail) }; return chain; };
  const matches = (row, filters) => filters.every(([column, value]) => row[column] === value);
  const db = {
    from: () => ({
      select: () => query(filters => failRead ? { data: null, error: failRead } : { data: state.rows.filter(row => matches(row, filters)), error: null }),
      insert: value => query(() => {
        if (state.rows.some(row => row.gallery === value.gallery)) return { data: null, error: { code: '23505' } };
        state.rows.push({ ...value }); return { data: [{ updated_at: value.updated_at }], error: null };
      }),
      update: value => query(filters => { const hit = state.rows.filter(row => matches(row, filters)); hit.forEach(row => Object.assign(row, value)); return { data: hit.map(row => ({ updated_at: row.updated_at })), error: null }; }),
    }),
    storage: { from: () => ({
      list: async () => ({ data: Object.entries(state.files).map(([name, created_at]) => ({ name, created_at })), error: null }),
      remove: async paths => { state.removed.push(...paths); for (const path of paths) delete state.files[path.split('/').pop()]; return { data: [], error: null }; },
      upload: async (path, bytes, options) => { state.uploaded.push({ path, options }); state.files[path.split('/').pop()] = new Date().toISOString(); return { data: {}, error: null }; },
      download: async path => state.files[path.split('/').pop()] ? { data: new Blob(['jpeg'], { type: 'image/jpeg' }), error: null } : { data: null, error: { message: 'missing' } },
    }) },
  };
  return { db, state };
}
function websiteApi(fake, { signedIn = true, revalidated = [] } = {}) {
  return load('app/api/studio/website-photos/route.ts', {
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    '@/lib/studio-auth': { hasStudioSession: async () => signedIn },
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => fake.db },
  });
}
const put = (body, origin = site) => new Request(`${site}/api/studio/website-photos`, { method: 'PUT', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
const old = new Date(Date.now() - 3 * 86400000).toISOString(), fresh = new Date().toISOString();

test('the Studio loads the starting photos until a gallery is saved', async () => {
  const response = await websiteApi(fakeDatabase()).GET();
  assert.equal(response.status, 200);
  const { galleries, library } = await response.json();
  assert.deepEqual(galleries.map(gallery => [gallery.key, gallery.photos.length, gallery.updatedAt]), [['home', 3, null], ['weddings', 13, null]]);
  assert.ok(library.length >= 15);
});

test('the Studio explains when the database update has not been applied', async () => {
  const response = await websiteApi(fakeDatabase({ failRead: { code: 'PGRST205' } })).GET();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /one-off update from Ashley/);
});

test('saving a gallery stores the new order, refreshes the pages and clears old removed uploads', async () => {
  const fake = fakeDatabase({ files: { [idOf(uploadA)]: fresh, [idOf(uploadB)]: old, 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee': old, 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee': fresh } });
  const revalidated = [];
  const api = websiteApi(fake, { revalidated });
  let response = await api.PUT(put({ gallery: 'home', updatedAt: null, photos: [{ src: uploadA, alt: 'Peonies' }, { src: '/assets/studio-consultations.jpg' }, { src: uploadB, alt: '' }] }));
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.deepEqual(first.photos.map(photo => photo.src), [uploadA, '/assets/studio-consultations.jpg', uploadB]);
  assert.deepEqual(revalidated, ['/', '/weddings']);
  // An old upload no gallery uses is deleted; a fresh unsaved upload is kept for a day.
  assert.deepEqual(fake.state.removed, ['test/website/cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee']);

  response = await api.PUT(put({ gallery: 'home', updatedAt: first.updatedAt, photos: [{ src: uploadA, alt: 'Peonies' }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(fake.state.rows[0].photos.map(photo => photo.src), [uploadA]);
  assert.ok(fake.state.removed.includes(`test/website/${idOf(uploadB)}`), 'the removed old upload is deleted');
});

test('a save from an out-of-date window is refused', async () => {
  const fake = fakeDatabase({ rows: [{ gallery: 'home', photos: [], updated_at: '2026-09-27T10:00:00.000Z' }] });
  const api = websiteApi(fake);
  let response = await api.PUT(put({ gallery: 'home', updatedAt: '2026-09-26T10:00:00.000Z', photos: [] }));
  assert.equal(response.status, 409);
  response = await api.PUT(put({ gallery: 'home', updatedAt: null, photos: [] }));
  assert.equal(response.status, 409);
  assert.deepEqual(fake.state.rows[0].updated_at, '2026-09-27T10:00:00.000Z');
});

test('saving refuses missing uploads, unknown galleries, other sites and signed-out visitors', async () => {
  const fake = fakeDatabase();
  assert.equal((await websiteApi(fake).PUT(put({ gallery: 'home', updatedAt: null, photos: [{ src: uploadA }] }))).status, 400);
  assert.equal((await websiteApi(fake).PUT(put({ gallery: 'hero', updatedAt: null, photos: [] }))).status, 400);
  assert.equal((await websiteApi(fake).PUT(put({ gallery: 'home', updatedAt: null, photos: [] }, 'https://evil.example'))).status, 403);
  assert.equal((await websiteApi(fake, { signedIn: false }).PUT(put({ gallery: 'home', updatedAt: null, photos: [] }))).status, 401);
  assert.equal(fake.state.rows.length, 0);
});

test('uploads are checked and stored in the website folder', async () => {
  const fake = fakeDatabase();
  const api = websiteApi(fake);
  const upload = bytes => { const form = new FormData(); form.append('file', new Blob([bytes]), 'photo.jpg'); return new Request(`${site}/api/studio/website-photos`, { method: 'POST', headers: { origin: site }, body: form }); };
  let response = await api.POST(upload(new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1])));
  assert.equal(response.status, 200);
  const { photo } = await response.json();
  assert.ok(photos.uploadedPhotoId(photo.src));
  assert.equal(fake.state.uploaded[0].path, `test/website/${idOf(photo.src)}`);
  assert.equal(fake.state.uploaded[0].options.contentType, 'image/jpeg');
  response = await api.POST(upload(new TextEncoder().encode('%PDF-1.7 not a photo')));
  assert.equal(response.status, 400);
  assert.equal(fake.state.uploaded.length, 1);
});

function photoRoute(fake, signedIn = false) {
  return load('app/site-photos/[id]/route.ts', {
    '@/lib/studio-auth': { hasStudioSession: async () => signedIn },
    '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => fake.db },
  });
}
const view = (route, src) => route.GET(new Request(`${site}${src}`), { params: Promise.resolve({ id: idOf(src) }) });

test('the website serves an uploaded photo only while a saved gallery shows it', async () => {
  const fake = fakeDatabase({ rows: [{ gallery: 'weddings', photos: [{ src: uploadA, alt: 'Roses' }], updated_at: fresh }], files: { [idOf(uploadA)]: fresh, [idOf(uploadB)]: fresh } });
  let response = await view(photoRoute(fake), uploadA);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /^public/);
  assert.equal((await view(photoRoute(fake), uploadB)).status, 404);
  response = await view(photoRoute(fake, true), uploadB);
  assert.equal(response.status, 200, 'the Studio can preview an unsaved upload');
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal((await view(photoRoute(fake, true), '/site-photos/not-a-photo')).status, 404);
});

test('public pages fall back to the starting photos when the galleries cannot be read', async () => {
  const server = fake => load('lib/site-photos-server.ts', { '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => fake?.db ?? null } });
  assert.equal((await server(null).loadGallery('home')).length, 3);
  assert.equal((await server(fakeDatabase({ failRead: { code: '42P01' } })).loadGallery('weddings')).length, 13);
  const saved = fakeDatabase({ rows: [{ gallery: 'home', photos: [{ src: '/assets/bouquet-04.jpg' }, { src: uploadA, alt: 'Roses' }], updated_at: fresh }, { gallery: 'weddings', photos: [], updated_at: fresh }] });
  assert.deepEqual((await server(saved).loadGallery('home')).map(photo => photo.src), [uploadA], 'photos that no longer check out are skipped');
  assert.deepEqual(await server(saved).loadGallery('weddings'), [], 'an emptied gallery stays empty');
});
