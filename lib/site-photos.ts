// Photo galleries on the public website that Jade can rearrange in the Studio.
// Each gallery starts with the photos below; once Jade saves a gallery in the
// Studio, the saved list (in public.site_photo_galleries) replaces them.
// Uploaded photos live in private storage and are served at /site-photos/<id>.

export type SitePhoto = { src: string; alt: string; label?: string; width?: number; height?: number };
export type GalleryKey = 'home' | 'weddings';
export type GalleryDefinition = { title: string; where: string; href: string; max: number; defaults: SitePhoto[] };

export const DEFAULT_PHOTO_ALT = 'Flowers by Bramble & Petal, florist in Southampton and the New Forest';
export const MAX_ALT_LENGTH = 200;

const weddingPhotos: SitePhoto[] = [
  { src: '/assets/weddings/ceremony-celebration.webp', width: 678, height: 1030, alt: 'A newly married couple kissing between pastel flower arrangements beneath a grand arched window', label: 'A moment to remember' },
  { src: '/assets/weddings/bridal-party-bouquets.webp', width: 1179, height: 1731, alt: 'A bride and bridesmaid holding white, pale blue and lilac bouquets on stone steps', label: 'Flowers to hold close' },
  { src: '/assets/weddings/flower-girl-crown.webp', width: 953, height: 1431, alt: 'A flower girl wearing a delicate white flower crown and carrying a basket of petals', label: 'The smallest, sweetest details' },
  { src: '/assets/weddings/pastel-pedestal-details.webp', width: 1440, height: 1920, alt: 'Green hydrangeas, white dahlias, pale yellow roses and lilac flowers in a wedding pedestal arrangement', label: 'Pastels in full bloom' },
  { src: '/assets/weddings/sunlit-ceremony-flowers.webp', width: 1440, height: 1920, alt: 'Sunlight falling across a pastel wedding flower arrangement beside a tall window', label: 'A little light, a little magic' },
  { src: '/assets/weddings/creating-wedding-flowers.webp', width: 1080, height: 1440, alt: 'A florist assembling a large pastel wedding arrangement in the studio, surrounded by stems and foliage', label: 'Made by hand, with heart' },
  { src: '/assets/weddings/pastel-flowers-arriving.webp', width: 1440, height: 1920, alt: 'A woman carrying a bucket of pale blue, white and soft yellow flowers in the sunshine', label: 'Gathered for your day' },
  { src: '/assets/weddings/wedding-02.jpg', alt: 'Two pastel floral arrangements on stone plinths framing a wedding ceremony table beneath an arched window', label: 'The ceremony, ready for you' },
  { src: '/assets/weddings/wedding-03.jpg', alt: 'A wedding arrangement of green hydrangeas, pale yellow roses, white flowers and lilac stems', label: 'Soft colour, natural texture' },
  { src: '/assets/weddings/wedding-04.jpg', alt: 'A florist placing the finishing touches on wedding ceremony flowers beside a tall window', label: 'Bringing the setting together' },
  { src: '/assets/weddings/wedding-05.jpg', alt: 'A florist arranging pastel wedding flowers on a stone pedestal in a sunlit room', label: 'Every stem, carefully placed' },
  { src: '/assets/weddings/wedding-07.jpg', alt: 'A florist carrying a large wedding flower arrangement towards the venue', label: 'From our studio to your day' },
  { src: '/assets/weddings/wedding-09.jpg', alt: 'A florist carrying green, white and pale yellow wedding flowers outside a brick venue', label: 'Flowers arriving with care' },
];

export const SITE_GALLERIES: Record<GalleryKey, GalleryDefinition> = {
  home: {
    title: 'Homepage: A closer look',
    where: 'The row of photos under “Nature, beautifully considered.” near the bottom of the homepage.',
    href: '/#work',
    max: 8,
    defaults: [
      { src: '/assets/studio-work-4.jpg', alt: 'Pale yellow and lilac flowers gathered on the studio workbench' },
      { src: '/assets/weddings/pastel-pedestal-details.webp', alt: 'A close look at cream roses and lilac wedding flowers' },
      { src: '/assets/studio-consultations.jpg', alt: 'The wooden Bramble & Petal consultation studio' },
    ],
  },
  weddings: {
    title: 'Weddings page gallery',
    where: 'The “A closer look at our work” gallery on the Weddings page. Visitors can tap a photo to see it larger.',
    href: '/weddings#wedding-gallery',
    max: 40,
    defaults: weddingPhotos,
  },
};
export const GALLERY_KEYS = Object.keys(SITE_GALLERIES) as GalleryKey[];
export const isGalleryKey = (value: unknown): value is GalleryKey => typeof value === 'string' && value in SITE_GALLERIES;

// Photos already on the website that Jade can put back into any gallery.
export const BUILT_IN_PHOTOS: SitePhoto[] = GALLERY_KEYS.flatMap(key => SITE_GALLERIES[key].defaults)
  .filter((photo, index, all) => all.findIndex(other => other.src === photo.src) === index);

const UPLOADED = /^\/site-photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const uploadedPhotoId = (src: string) => UPLOADED.exec(src)?.[1] ?? null;
export const uploadedPhotoSrc = (id: string) => `/site-photos/${id}`;

export class GalleryError extends Error {}
const dimension = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10000 ? value : undefined;

/** Checks a gallery list from the Studio and returns the photos to save, in order. */
export function validateGalleryPhotos(key: GalleryKey, value: unknown): SitePhoto[] {
  const gallery = SITE_GALLERIES[key];
  if (!Array.isArray(value)) throw new GalleryError('Send the list of photos to show.');
  if (value.length > gallery.max) throw new GalleryError(`${gallery.title} can show up to ${gallery.max} photos. Remove some before saving.`);
  const seen = new Set<string>();
  return value.map((item): SitePhoto => {
    if (!item || typeof item !== 'object' || typeof (item as SitePhoto).src !== 'string') throw new GalleryError('One of the photos could not be read. Reload and try again.');
    const { src, alt: rawAlt, width, height } = item as SitePhoto;
    if (seen.has(src)) throw new GalleryError('The same photo appears twice. Remove one copy before saving.');
    seen.add(src);
    if (rawAlt !== undefined && typeof rawAlt !== 'string') throw new GalleryError('Photo descriptions must be text.');
    const alt = (rawAlt ?? '').replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (alt.length > MAX_ALT_LENGTH) throw new GalleryError(`Keep each photo description under ${MAX_ALT_LENGTH} characters.`);
    const builtIn = BUILT_IN_PHOTOS.find(photo => photo.src === src);
    if (builtIn) return { ...builtIn, alt: alt || builtIn.alt };
    if (!uploadedPhotoId(src)) throw new GalleryError('One of the photos is not from the website or the Studio. Reload and try again.');
    const photo: SitePhoto = { src, alt: alt || DEFAULT_PHOTO_ALT };
    const w = dimension(width), h = dimension(height);
    if (w && h) { photo.width = w; photo.height = h; }
    return photo;
  });
}

// The homepage strip shows rows of four on desktop and pairs on phones; a
// shorter last row stretches its photos to fill the width (see public-site.css).
export function stripPhotoSizes(index: number, count: number) {
  const row = Math.floor(index / 4), lastRow = Math.floor((count - 1) / 4);
  const perRow = row < lastRow ? 4 : count - lastRow * 4;
  const phone = count % 2 === 1 && index === count - 1 ? 100 : 50;
  return `(max-width: 700px) ${phone}vw, ${Math.ceil(100 / perRow)}vw`;
}
