import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { boundedBody, imageMediaType, InvoiceError } from '@/lib/supplier-invoice-server';
import { BUILT_IN_PHOTOS, GALLERY_KEYS, GalleryError, SITE_GALLERIES, isGalleryKey, uploadedPhotoId, uploadedPhotoSrc, validateGalleryPhotos } from '@/lib/site-photos';
import { GALLERY_TABLE, readGalleries, SITE_PHOTO_BUCKET, SITE_PHOTO_FOLDER } from '@/lib/site-photos-server';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const MAX_UPLOAD = 3 * 1024 * 1024;
// Uploads not yet saved into a gallery are kept for a day, so a photo added to
// an unsaved gallery isn't cleared away while Jade is still arranging it.
const KEEP_UNSAVED_MS = 24 * 60 * 60 * 1000;
const NOT_READY = 'Website photos are not switched on yet. The database needs a one-off update from Ashley first.';
const CONFLICT = 'These photos were changed in another window. Reload the page to see the latest version, then make your changes again.';
const missingTable = (error: unknown) => ['42P01', 'PGRST205'].includes(String((error as { code?: unknown })?.code));

async function storedPhotos(db: SupabaseClient) {
  const { data, error } = await db.storage.from(SITE_PHOTO_BUCKET).list(SITE_PHOTO_FOLDER, { limit: 1000 });
  if (error) throw error;
  return new Map((data || []).filter(file => uploadedPhotoId(uploadedPhotoSrc(file.name))).map(file => [file.name, Date.parse(file.created_at || '') || 0]));
}

// Deletes uploaded files no saved gallery uses any more (removed photos, and
// uploads that were never saved), apart from ones uploaded in the last day.
async function removeUnusedPhotos(db: SupabaseClient, stored: Map<string, number>) {
  const galleries = await readGalleries(db);
  const used = new Set(GALLERY_KEYS.flatMap(key => galleries[key].photos.map(photo => uploadedPhotoId(photo.src)).filter(Boolean)));
  const unused = [...stored].filter(([id, created]) => !used.has(id) && Date.now() - created > KEEP_UNSAVED_MS).map(([id]) => `${SITE_PHOTO_FOLDER}/${id}`);
  if (unused.length) await db.storage.from(SITE_PHOTO_BUCKET).remove(unused);
}

export async function GET() {
  if (!await hasStudioSession()) return json({ error: 'Please sign in.' }, 401);
  const db = createStudioDatabaseClient(); if (!db) return json({ error: 'Website photos are unavailable.' }, 503);
  try {
    const saved = await readGalleries(db);
    return json({
      galleries: GALLERY_KEYS.map(key => { const { title, where, href, max } = SITE_GALLERIES[key]; return { key, title, where, href, max, ...saved[key] }; }),
      library: BUILT_IN_PHOTOS,
    });
  } catch (error) {
    return json({ error: missingTable(error) ? NOT_READY : 'Website photos could not be loaded. Please try again.' }, 503);
  }
}

// Uploads one photo. It only appears on the website once a gallery listing it is saved.
export async function POST(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in to upload a photo.' }, 401);
  try {
    requireSameOrigin(request);
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('multipart/form-data')) return json({ error: 'Choose a photo.' }, 400);
    const raw = await boundedBody(request, MAX_UPLOAD + 65536);
    const file = (await new Response(raw, { headers: { 'Content-Type': type } }).formData()).get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD) return json({ error: 'Choose a JPEG, PNG or WebP photo under 3 MB.' }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const media = imageMediaType(bytes);
    const db = createStudioDatabaseClient(); if (!db) return json({ error: 'Website photos are unavailable.' }, 503);
    const id = randomUUID();
    const { error } = await db.storage.from(SITE_PHOTO_BUCKET).upload(`${SITE_PHOTO_FOLDER}/${id}`, bytes, { contentType: media, upsert: false });
    if (error) throw error;
    return json({ photo: { src: uploadedPhotoSrc(id) } });
  } catch (error) {
    if (error instanceof RequestError || error instanceof InvoiceError) return json({ error: error.message }, error.status);
    return json({ error: 'The photo could not be uploaded. Use a JPEG, PNG or WebP under 3 MB and try again.' }, 400);
  }
}

// Saves a gallery's whole photo list, in order, and refreshes the website pages that show it.
export async function PUT(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in.' }, 401);
  try {
    requireSameOrigin(request);
    const body = await readJsonObject(request, 65_536);
    if (!isGalleryKey(body.gallery)) return json({ error: 'Choose a gallery to save.' }, 400);
    const key = body.gallery;
    const photos = validateGalleryPhotos(key, body.photos);
    if (body.updatedAt !== null && typeof body.updatedAt !== 'string') return json({ error: 'Reload the page and try again.' }, 400);
    const db = createStudioDatabaseClient(); if (!db) return json({ error: 'Website photos are unavailable.' }, 503);
    const stored = await storedPhotos(db);
    if (photos.some(photo => { const id = uploadedPhotoId(photo.src); return id && !stored.has(id); })) return json({ error: 'One of the uploaded photos is missing. Remove it, upload it again, then save.' }, 400);
    const updated_at = new Date().toISOString();
    const saved = body.updatedAt === null
      ? await db.from(GALLERY_TABLE).insert({ workspace_key: STUDIO_WORKSPACE, gallery: key, photos, updated_at }).select('updated_at')
      : await db.from(GALLERY_TABLE).update({ photos, updated_at }).eq('workspace_key', STUDIO_WORKSPACE).eq('gallery', key).eq('updated_at', body.updatedAt).select('updated_at');
    if (saved.error?.code === '23505') return json({ error: CONFLICT }, 409);
    if (saved.error) throw saved.error;
    if (!saved.data?.length) return json({ error: CONFLICT }, 409);
    revalidatePath('/');
    revalidatePath('/weddings');
    await removeUnusedPhotos(db, stored).catch(() => undefined);
    return json({ saved: true, photos, updatedAt: saved.data[0].updated_at });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof GalleryError) return json({ error: error.message }, 400);
    return json({ error: missingTable(error) ? NOT_READY : 'The photos could not be saved. Please try again.' }, 503);
  }
}
