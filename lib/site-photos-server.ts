import type { SupabaseClient } from '@supabase/supabase-js';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { GALLERY_KEYS, SITE_GALLERIES, validateGalleryPhotos, type GalleryKey, type SitePhoto } from '@/lib/site-photos';

// Server only. Uploaded website photos sit in the private studio-assets bucket
// under their own folder, apart from client and invoice files.
export const SITE_PHOTO_BUCKET = 'studio-assets';
export const SITE_PHOTO_FOLDER = `${STUDIO_WORKSPACE}/website`;
export const GALLERY_TABLE = 'site_photo_galleries';

export type SavedGallery = { photos: SitePhoto[]; updatedAt: string | null };

// A saved photo that no longer checks out (say, a built-in photo since deleted
// from the code) is skipped rather than hiding the whole gallery.
function storedPhotos(key: GalleryKey, value: unknown): SitePhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => { try { return validateGalleryPhotos(key, [item]); } catch { return []; } }).slice(0, SITE_GALLERIES[key].max);
}

/** Every gallery as the website shows it: the saved list, or the starting photos if never saved. */
export async function readGalleries(db: SupabaseClient): Promise<Record<GalleryKey, SavedGallery>> {
  const { data, error } = await db.from(GALLERY_TABLE).select('gallery,photos,updated_at').eq('workspace_key', STUDIO_WORKSPACE);
  if (error) throw error;
  const galleries = {} as Record<GalleryKey, SavedGallery>;
  for (const key of GALLERY_KEYS) {
    const row = data?.find(item => item.gallery === key);
    galleries[key] = row ? { photos: storedPhotos(key, row.photos), updatedAt: row.updated_at } : { photos: SITE_GALLERIES[key].defaults, updatedAt: null };
  }
  return galleries;
}

/** Photos for a public page. Falls back to the starting photos if the database can't be read. */
export async function loadGallery(key: GalleryKey): Promise<SitePhoto[]> {
  try {
    const db = createStudioDatabaseClient();
    if (!db) return SITE_GALLERIES[key].defaults;
    return (await readGalleries(db))[key].photos;
  } catch {
    return SITE_GALLERIES[key].defaults;
  }
}
