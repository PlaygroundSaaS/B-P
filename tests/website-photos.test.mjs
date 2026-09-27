import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Website photos: Jade changes the photos on every page of the website in the Studio.
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

test('descriptions are not edited in the Studio: built-in photos keep theirs and uploads get the section\'s', () => {
  const saved = photos.validateGalleryPhotos('weddings', [
    { src: uploadA, alt: 'Typed in the Studio', width: 1500, height: 2000 },
    { src: '/assets/weddings/flower-girl-crown.webp', alt: 'Changed', width: 1, height: 1, label: 'Changed' },
    { src: uploadB, width: 0, height: 900 },
  ]);
  assert.deepEqual(saved[0], { src: uploadA, alt: photos.SITE_GALLERIES.weddings.alt, width: 1500, height: 2000 });
  assert.deepEqual(saved[1], photos.BUILT_IN_PHOTOS.find(photo => photo.src === '/assets/weddings/flower-girl-crown.webp'));
  assert.deepEqual(saved[2], { src: uploadB, alt: photos.SITE_GALLERIES.weddings.alt });
  assert.match(photos.validateGalleryPhotos('funerals-page', [{ src: uploadA }, null, null, null])[0].alt, /^Funeral flowers by Bramble & Petal/);
});

test('a gallery refuses photos from elsewhere, repeats and too many photos', () => {
  const check = (key, list) => () => photos.validateGalleryPhotos(key, list);
  assert.throws(check('home', [{ src: '/assets/bouquet-04.jpg', alt: '' }]), /not from the website or the Studio/);
  assert.throws(check('home', [{ src: 'https://example.com/photo.jpg' }]), /not from the website/);
  assert.throws(check('home', [{ src: '/site-photos/../../secret' }]), /not from the website/);
  assert.throws(check('home', [{ src: uploadA }, { src: uploadA }]), /appears twice/);
  assert.throws(check('home', [null]), /could not be read/);
  assert.throws(check('home', Array.from({ length: 9 }, (_, i) => ({ src: `/site-photos/11111111-2222-4333-8444-55555555555${i}` }))), /up to 8 photos/);
  assert.throws(check('home', 'photos'), /list of photos/);
  assert.deepEqual(photos.validateGalleryPhotos('home', []), []);
});

test('single photos can be swapped, and only the ones that can be empty removed', () => {
  const check = (key, list) => () => photos.validateGalleryPhotos(key, list);
  const [large, top, framed] = photos.validateGalleryPhotos('home-weddings', [{ src: uploadA }, { src: '/assets/sympathy-spray.jpg' }, { src: uploadA }]);
  assert.equal(large.src, uploadA);
  assert.equal(top.src, '/assets/sympathy-spray.jpg');
  assert.equal(framed.src, uploadA, 'the same photo can sit in two spots');
  assert.throws(check('home-banner', [null]), /Top banner needs a photo/);
  assert.throws(check('home-services', [{ src: uploadA }, null, { src: uploadA }]), /Funerals card needs a photo/);
  assert.throws(check('home-services', [{ src: uploadA }]), /could not be read/);
  assert.throws(check('funerals-page', [null, null, null, null]), /Top of the page needs a photo/);
  assert.deepEqual(photos.validateGalleryPhotos('funerals-page', [{ src: '/assets/sympathy-spray.jpg' }, null, { src: uploadA }, null]).map(photo => photo?.src ?? null), ['/assets/sympathy-spray.jpg', null, uploadA, null]);
  assert.deepEqual(photos.validateGalleryPhotos('corporate-page', [null, null, null, null]), [null, null, null, null], 'Corporate can keep its designed panel');
});

test('every page has a section, starting with the photos it showed before', () => {
  const byPage = {};
  for (const key of photos.GALLERY_KEYS) (byPage[photos.SITE_GALLERIES[key].page] ??= []).push(key);
  assert.deepEqual(Object.keys(byPage), ['Homepage', 'Weddings', 'Funerals', 'Everyday flowers', 'Corporate', 'Our studio', 'Client Studio']);
  assert.deepEqual(byPage.Homepage, ['home-banner', 'home-welcome', 'home-services', 'home-weddings', 'home-studio', 'home-remembrance', 'home']);
  assert.deepEqual(photos.defaultPhotos('funerals-page').map(photo => photo?.src ?? null), ['/assets/sympathy-spray.jpg', '/assets/sympathy-tribute.jpg', null, null]);
  assert.deepEqual(photos.defaultPhotos('home-remembrance').map(photo => photo.src), ['/assets/sympathy-tribute.jpg']);
  assert.equal(photos.SITE_GALLERIES.home.defaults.length, 3);
  assert.equal(photos.SITE_GALLERIES.weddings.defaults.length, 13);
  for (const key of photos.GALLERY_KEYS) {
    const section = photos.SITE_GALLERIES[key];
    if (section.kind === 'spots') for (const spot of section.spots) assert.ok(spot.photo || spot.empty, `${key}: ${spot.name} starts with a photo or can be empty`);
  }
  for (const photo of photos.BUILT_IN_PHOTOS) assert.ok(existsSync(resolve(root, 'public', photo.src.slice(1))), photo.src);
  assert.equal(photos.BUILT_IN_PHOTOS.some(photo => photo.src.includes('bouquet-04')), false);
  assert.equal(new Set(photos.BUILT_IN_PHOTOS.map(photo => photo.src)).size, photos.BUILT_IN_PHOTOS.length);
});

test('the public pages take every photo from Website photos, apart from the logo', () => {
  for (const page of ['app/page.tsx', 'app/public/service-page.tsx', 'app/weddings/page.tsx', 'app/funerals/page.tsx', 'app/flowers/page.tsx', 'app/corporate/page.tsx', 'app/our-studio/page.tsx', 'app/client-studio/page.tsx']) {
    const assets = readFileSync(resolve(root, page), 'utf8').match(/\/assets\/[\w./-]+/g) ?? [];
    assert.deepEqual(assets.filter(src => !src.startsWith('/assets/brand-')), [], page);
  }
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

test('the Studio loads the starting photos until a section is saved, page by page', async () => {
  const fake = fakeDatabase({ rows: [{ gallery: 'funerals-page', photos: [{ src: uploadA }, null, null, null], updated_at: fresh }] });
  const response = await websiteApi(fake).GET();
  assert.equal(response.status, 200);
  const { galleries, library } = await response.json();
  assert.equal(galleries.length, photos.GALLERY_KEYS.length);
  const byKey = Object.fromEntries(galleries.map(gallery => [gallery.key, gallery]));
  assert.deepEqual([byKey.home.kind, byKey.home.max, byKey.home.photos.length, byKey.home.updatedAt], ['gallery', 8, 3, null]);
  assert.equal(byKey.weddings.photos.length, 13);
  assert.equal(byKey['funerals-page'].page, 'Funerals');
  assert.deepEqual(byKey['funerals-page'].spots.map(spot => spot.name), ['Top of the page', 'Beside “Something meaningful.”', 'Beside “The right shape and scale.”', 'Beside “The details, taken care of.”']);
  assert.deepEqual(byKey['funerals-page'].photos.map(photo => photo?.src ?? null), [uploadA, null, null, null]);
  assert.equal(byKey['funerals-page'].updatedAt, fresh);
  assert.equal(byKey['home-banner'].spots[0].empty, undefined, 'the banner cannot be left empty');
  assert.ok(library.length >= 19);
  assert.equal(library.at(-1).src, uploadA, 'a saved upload can be chosen for other sections');
});

test('the Studio explains when the database update has not been applied', async () => {
  const response = await websiteApi(fakeDatabase({ failRead: { code: 'PGRST205' } })).GET();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /one-off update from Ashley/);
});

test('saving a gallery stores the new order, refreshes its page and clears old removed uploads', async () => {
  const fake = fakeDatabase({ files: { [idOf(uploadA)]: fresh, [idOf(uploadB)]: old, 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee': old, 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee': fresh } });
  const revalidated = [];
  const api = websiteApi(fake, { revalidated });
  let response = await api.PUT(put({ gallery: 'home', updatedAt: null, photos: [{ src: uploadA, alt: 'Peonies' }, { src: '/assets/studio-consultations.jpg' }, { src: uploadB, alt: '' }] }));
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.deepEqual(first.photos.map(photo => photo.src), [uploadA, '/assets/studio-consultations.jpg', uploadB]);
  assert.deepEqual(revalidated, ['/']);
  // An old upload no gallery uses is deleted; a fresh unsaved upload is kept for a day.
  assert.deepEqual(fake.state.removed, ['test/website/cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee']);

  response = await api.PUT(put({ gallery: 'home', updatedAt: first.updatedAt, photos: [{ src: uploadA, alt: 'Peonies' }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(fake.state.rows[0].photos.map(photo => photo.src), [uploadA]);
  assert.ok(fake.state.removed.includes(`test/website/${idOf(uploadB)}`), 'the removed old upload is deleted');
});

test('saving a page\'s photos refreshes that page and keeps uploads it uses', async () => {
  const fake = fakeDatabase({ files: { [idOf(uploadA)]: old, [idOf(uploadB)]: old } });
  const revalidated = [];
  const response = await websiteApi(fake, { revalidated }).PUT(put({ gallery: 'funerals-page', updatedAt: null, photos: [{ src: '/assets/sympathy-tribute.jpg' }, null, { src: uploadA }, null] }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).photos.map(photo => photo?.src ?? null), ['/assets/sympathy-tribute.jpg', null, uploadA, null]);
  assert.deepEqual(revalidated, ['/funerals']);
  assert.deepEqual(fake.state.removed, [`test/website/${idOf(uploadB)}`]);
  assert.equal((await websiteApi(fake).PUT(put({ gallery: 'home-banner', updatedAt: null, photos: [null] }))).status, 400);
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

test('the website serves an uploaded photo only while a saved section shows it', async () => {
  const fake = fakeDatabase({ rows: [{ gallery: 'home-welcome', photos: [{ src: uploadA, alt: 'Roses' }], updated_at: fresh }], files: { [idOf(uploadA)]: fresh, [idOf(uploadB)]: fresh } });
  let response = await view(photoRoute(fake), uploadA);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /^public/);
  assert.equal((await view(photoRoute(fake), uploadB)).status, 404);
  response = await view(photoRoute(fake, true), uploadB);
  assert.equal(response.status, 200, 'the Studio can preview an unsaved upload');
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal((await view(photoRoute(fake, true), '/site-photos/not-a-photo')).status, 404);
});

test('public pages fall back to the starting photos when the sections cannot be read', async () => {
  const server = fake => load('lib/site-photos-server.ts', { '@/lib/studio-database': { STUDIO_WORKSPACE: 'test', createStudioDatabaseClient: () => fake?.db ?? null } });
  assert.equal((await server(null).loadSitePhotos()).home.length, 3);
  const unreadable = await server(fakeDatabase({ failRead: { code: '42P01' } })).loadSitePhotos();
  assert.equal(unreadable.weddings.length, 13);
  assert.equal(unreadable['home-banner'][0].src, '/assets/weddings/wedding-hero-wide.webp');
  const saved = await server(fakeDatabase({ rows: [
    { gallery: 'home', photos: [{ src: '/assets/bouquet-04.jpg' }, { src: uploadA, alt: 'Roses' }], updated_at: fresh },
    { gallery: 'weddings', photos: [], updated_at: fresh },
    { gallery: 'home-services', photos: [null, { src: '/assets/bouquet-04.jpg' }], updated_at: fresh },
    { gallery: 'weddings-page', photos: [{ src: uploadB }, null], updated_at: fresh },
  ] })).loadSitePhotos();
  assert.deepEqual(saved.home.map(photo => photo.src), [uploadA], 'photos that no longer check out are skipped');
  assert.deepEqual(saved.weddings, [], 'an emptied gallery stays empty');
  assert.deepEqual(saved['home-services'].map(photo => photo.src), photos.defaultPhotos('home-services').map(photo => photo.src), 'a spot that needs a photo falls back to its starting one');
  assert.deepEqual(saved['weddings-page'].map(photo => photo?.src ?? null), [uploadB, null, '/assets/weddings/pastel-pedestal-details.webp', null], 'an emptied spot stays empty and a spot added later starts with its own photo');
});
