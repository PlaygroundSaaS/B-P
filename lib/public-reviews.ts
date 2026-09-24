import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';

export type PublicReview = { id: string; public_name: string; review_text: string; rating: number; occasion: string; highlight: string | null };

// Published reviews for server rendering, so search engines see them in the page HTML.
// Returns an empty list on any failure; the browser still loads /api/reviews afterwards.
export async function loadPublishedReviews(): Promise<PublicReview[]> {
  try {
    const db = createStudioDatabaseClient(); if (!db) return [];
    const { data, error } = await db.from('studio_reviews').select('id,public_name,review_text,rating,occasion,highlight').eq('workspace_key', STUDIO_WORKSPACE).eq('published', true).not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).limit(100);
    return error || !data ? [] : data as PublicReview[];
  } catch { return []; }
}
