export const reviewOccasions = ['Wedding', 'Funeral flowers', 'Corporate event', 'Everyday flowers', 'Other'] as const;
export function validateReview(body: Record<string, unknown>) {
 const name = typeof body.name === 'string' ? body.name.trim() : '';
 const message = typeof body.message === 'string' ? body.message.trim() : '';
 const rating = body.rating;
 const occasion = typeof body.occasion === 'string' && reviewOccasions.some(value=>value===body.occasion) ? body.occasion : 'Other';
 if (!name || name.length > 80) throw new Error('Please enter a display name of up to 80 characters.');
 if (message.length < 10 || message.length > 2000) throw new Error('Please write a review between 10 and 2,000 characters.');
 if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Please choose a rating from 1 to 5.');
 if (body.consent !== true) throw new Error('Please confirm you agree to publish your review.');
 return {public_name:name,review_text:message,rating,occasion,consent:true};
}
export function parseReviewToken(value: unknown) {
 if (typeof value !== 'string') return null;
 const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(value);
 return match ? {id:match[1],secret:match[2]} : null;
}
export const HIGHLIGHT_MAX = 280;
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
// A highlight must be the client's own words: a passage copied from their review.
export function validateHighlight(value: unknown, reviewText: string) {
 if (value === null || value === undefined) return null;
 if (typeof value !== 'string') throw new Error('Choose a highlight from the review text.');
 const highlight = collapse(value).replace(/^["'“‘]+|["'”’]+$/g, '').trim();
 if (!highlight) return null;
 if (highlight.length < 3 || highlight.length > HIGHLIGHT_MAX) throw new Error(`Keep the highlight between 3 and ${HIGHLIGHT_MAX} characters.`);
 if (!collapse(reviewText).includes(highlight)) throw new Error('The highlight must be copied word for word from the client’s review.');
 return highlight;
}
// True when the database has not had the highlight migration yet, so reviews still load without it.
export function isMissingHighlightColumn(error: { code?: string; message?: string } | null | undefined) {
 return !!error && (error.code === '42703' || error.code === 'PGRST204') && /highlight/.test(error.message ?? '');
}
// Clients can attach up to three photos to a review. The browser resizes them first,
// so three always fit within Vercel's 4.5 MB request limit.
export const REVIEW_PHOTO_LIMIT = 3;
export const REVIEW_PHOTO_MAX_BYTES = 1_400_000;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const reviewPhotoUrl = (review: string, photo: string) => `/api/reviews/${review}/photos/${photo}`;
// Recognises JPEG, PNG and WebP by their first bytes, whatever the file name or browser claims.
export function reviewPhotoType(bytes: Uint8Array) {
 if (bytes.length < 12) return null;
 const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
 if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
 if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png';
 if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
 return null;
}
