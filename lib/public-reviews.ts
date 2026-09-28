import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { isMissingHighlightColumn } from '@/lib/review-validation';

export type PublicReview = { id: string; public_name: string; review_text: string; rating: number; occasion: string; highlight: string | null; photos: string[] };

// Review photos live in a private bucket; /api/reviews/<review>/photos/<photo> decides who may see them.
export const REVIEW_PHOTO_BUCKET = 'review-photos';
export const reviewPhotoPath = (review: string, photo: string) => `${STUDIO_WORKSPACE}/${review}/${photo}`;

type QueryError = { code?: string; message?: string } | null;
// Until the review photos migration is applied, reviews still load, just without photos.
// Likewise, if the highlight column is missing, reviews load without highlights.
export async function selectWithReviewPhotos<Row>(select: (columns: string) => PromiseLike<{ data: unknown; error: QueryError }>, columns: string) {
  let result = await selectPhotos<Row>(select, columns);
  if (isMissingHighlightColumn(result.error) && columns.split(',').includes('highlight')) result = await selectPhotos<Row>(select, columns.split(',').filter(column => column !== 'highlight').join(','));
  return result;
}
async function selectPhotos<Row>(select: (columns: string) => PromiseLike<{ data: unknown; error: QueryError }>, columns: string) {
  let { data, error } = await select(`${columns},photos`);
  const missing = !!error && (error.code === '42703' || error.code === 'PGRST204') && /photos/.test(error.message ?? '');
  if (missing) ({ data, error } = await select(columns));
  const rows = Array.isArray(data) ? (data as Row[]).map(row => ({ ...row, photos: (row as { photos?: string[] | null }).photos ?? [] })) : null;
  return { data: error ? null : rows, error };
}

// Published reviews for server rendering, so search engines see them in the page HTML.
// Returns an empty list on any failure; the browser still loads /api/reviews afterwards.
export async function loadPublishedReviews(): Promise<PublicReview[]> {
  try {
    const db = createStudioDatabaseClient(); if (!db) return [];
    const { data } = await selectWithReviewPhotos<PublicReview>(columns => db.from('studio_reviews').select(columns).eq('workspace_key', STUDIO_WORKSPACE).eq('published', true).not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).limit(100), 'id,public_name,review_text,rating,occasion,highlight');
    return data ?? [];
  } catch { return []; }
}
