import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { REVIEW_PHOTO_BUCKET, reviewPhotoPath } from '@/lib/public-reviews';
import { isUuid } from '@/lib/review-validation';
// A review photo is public while its review is published. The Studio can see every photo,
// so Jade can check them before publishing.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photo: string }> }) {
  const { id, photo } = await params; const hidden = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const missing = () => new Response('Not found', { status: 404, headers: hidden });
  if (!isUuid(id) || !isUuid(photo)) return missing();
  const db = createStudioDatabaseClient(); if (!db) return new Response('Unavailable', { status: 503, headers: hidden });
  const { data: review, error } = await db.from('studio_reviews').select('published,submitted_at,photos').eq('id', id).eq('workspace_key', STUDIO_WORKSPACE).maybeSingle();
  if (error || !review?.submitted_at || !(review.photos as string[] | null)?.includes(photo)) return missing();
  const published = review.published === true;
  if (!published && !await hasStudioSession()) return missing();
  const { data, error: downloadError } = await db.storage.from(REVIEW_PHOTO_BUCKET).download(reviewPhotoPath(id, photo));
  if (downloadError || !data) return missing();
  return new Response(data, { headers: { 'Content-Type': data.type || 'application/octet-stream', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': published ? 'public, max-age=3600, s-maxage=3600' : 'private, no-store' } });
}
