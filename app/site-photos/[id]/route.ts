import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient } from '@/lib/studio-database';
import { GALLERY_KEYS, uploadedPhotoId, uploadedPhotoSrc } from '@/lib/site-photos';
import { readGalleries, SITE_PHOTO_BUCKET, SITE_PHOTO_FOLDER } from '@/lib/site-photos-server';

// A photo Jade uploaded for the website. Anyone can see it while a saved
// gallery lists it; before that (or after it is removed) only the Studio can.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  const src = uploadedPhotoSrc(id);
  if (uploadedPhotoId(src) !== id) return missing();
  const db = createStudioDatabaseClient(); if (!db) return missing();
  let listed = false;
  try {
    const galleries = await readGalleries(db);
    listed = GALLERY_KEYS.some(key => galleries[key].photos.some(photo => photo.src === src));
  } catch { /* galleries unavailable: only the Studio can see uploads */ }
  if (!listed && !await hasStudioSession()) return missing();
  const { data, error } = await db.storage.from(SITE_PHOTO_BUCKET).download(`${SITE_PHOTO_FOLDER}/${id}`);
  if (error || !data || !['image/jpeg', 'image/png', 'image/webp'].includes(data.type)) return missing();
  return new Response(data, { headers: { 'Content-Type': data.type, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': listed ? 'public, max-age=3600, s-maxage=86400' : 'private, no-store' } });
}
