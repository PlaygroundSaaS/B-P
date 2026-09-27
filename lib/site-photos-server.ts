import type { SupabaseClient } from '@supabase/supabase-js';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { defaultPhotos, GALLERY_KEYS, storedGalleryPhotos, type GalleryKey, type SectionPhotos } from '@/lib/site-photos';

// Server only. Uploaded website photos sit in the private studio-assets bucket
// under their own folder, apart from client and invoice files.
export const SITE_PHOTO_BUCKET = 'studio-assets';
export const SITE_PHOTO_FOLDER = `${STUDIO_WORKSPACE}/website`;
export const GALLERY_TABLE = 'site_photo_galleries';

export type SavedGallery = { photos: SectionPhotos; updatedAt: string | null };
export type SitePhotos = Record<GalleryKey, SectionPhotos>;

/** Every section as the website shows it: the saved photos, or the starting photos if never saved. */
export async function readGalleries(db: SupabaseClient): Promise<Record<GalleryKey, SavedGallery>> {
  const { data, error } = await db.from(GALLERY_TABLE).select('gallery,photos,updated_at').eq('workspace_key', STUDIO_WORKSPACE);
  if (error) throw error;
  const galleries = {} as Record<GalleryKey, SavedGallery>;
  for (const key of GALLERY_KEYS) {
    const row = data?.find(item => item.gallery === key);
    galleries[key] = row ? { photos: storedGalleryPhotos(key, row.photos), updatedAt: row.updated_at } : { photos: defaultPhotos(key), updatedAt: null };
  }
  return galleries;
}

const startingPhotos = () => Object.fromEntries(GALLERY_KEYS.map(key => [key, defaultPhotos(key)])) as SitePhotos;

/** Photos for the public pages. Falls back to the starting photos if the database can't be read. */
export async function loadSitePhotos(): Promise<SitePhotos> {
  try {
    const db = createStudioDatabaseClient();
    if (!db) return startingPhotos();
    const galleries = await readGalleries(db);
    return Object.fromEntries(GALLERY_KEYS.map(key => [key, galleries[key].photos])) as SitePhotos;
  } catch {
    return startingPhotos();
  }
}
