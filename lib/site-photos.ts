// Every photo on the public website that Jade can change in the Studio, page by
// page. A "gallery" is a row or grid of photos she can add to, remove from and
// arrange. A "spots" section is a set of single photos in the page design (a
// banner, the photo beside a heading): each one can be swapped, and the
// optional ones removed. The logo and brand mark stay fixed.
// Each section starts with the photos below; once Jade saves it in the Studio,
// the saved list (in public.site_photo_galleries) replaces them.
// Uploaded photos live in private storage and are served at /site-photos/<id>.

export type SitePhoto = { src: string; alt: string; width?: number; height?: number };
/** One photo in the page design. A spot with `empty` can be left without a photo; it says what shows instead. */
export type Spot = { name: string; photo: SitePhoto | null; empty?: string; position?: string };
type SectionBase = { page: string; title: string; where: string; href: string; tip?: string; alt: string };
export type GalleryDefinition = SectionBase & ({ kind: 'gallery'; max: number; defaults: SitePhoto[] } | { kind: 'spots'; spots: Spot[] });
/** A section's photos in order. Only a spot that can be left empty is ever null. */
export type SectionPhotos = (SitePhoto | null)[];

export const DEFAULT_PHOTO_ALT = 'Flowers by Bramble & Petal, florist in Southampton and the New Forest';
const WEDDING_ALT = 'Wedding flowers by Bramble & Petal, florist in Southampton and the New Forest';
const FUNERAL_ALT = 'Funeral flowers by Bramble & Petal, florist in Southampton and the New Forest';

const photo = (src: string, width: number, height: number, alt: string): SitePhoto => ({ src, alt, width, height });
const p = {
  hero: photo('/assets/weddings/wedding-hero-wide.webp', 1942, 809, 'A wedding couple surrounded by pastel floral arrangements in a light-filled ceremony room'),
  celebration: photo('/assets/weddings/ceremony-celebration.webp', 678, 1030, 'A newly married couple kissing between pastel flower arrangements beneath a grand arched window'),
  bridalParty: photo('/assets/weddings/bridal-party-bouquets.webp', 1179, 1731, 'A bride and bridesmaid holding white, pale blue and lilac bouquets on stone steps'),
  flowerGirl: photo('/assets/weddings/flower-girl-crown.webp', 953, 1431, 'A flower girl wearing a delicate white flower crown and carrying a basket of petals'),
  pedestal: photo('/assets/weddings/pastel-pedestal-details.webp', 1440, 1920, 'Green hydrangeas, white dahlias, pale yellow roses and lilac flowers in a wedding pedestal arrangement'),
  sunlit: photo('/assets/weddings/sunlit-ceremony-flowers.webp', 1440, 1920, 'Sunlight falling across a pastel wedding flower arrangement beside a tall window'),
  creating: photo('/assets/weddings/creating-wedding-flowers.webp', 1080, 1440, 'A florist assembling a large pastel wedding arrangement in the studio'),
  arriving: photo('/assets/weddings/pastel-flowers-arriving.webp', 1440, 1920, 'A woman carrying a bucket of pale blue, white and soft yellow flowers in the sunshine'),
  wedding02: photo('/assets/weddings/wedding-02.jpg', 1536, 2048, 'Two pastel floral arrangements on stone plinths framing a wedding ceremony table beneath an arched window'),
  wedding03: photo('/assets/weddings/wedding-03.jpg', 1536, 2048, 'A wedding arrangement of green hydrangeas, pale yellow roses, white flowers and lilac stems'),
  wedding04: photo('/assets/weddings/wedding-04.jpg', 1536, 2048, 'A florist placing the finishing touches on wedding ceremony flowers beside a tall window'),
  wedding05: photo('/assets/weddings/wedding-05.jpg', 1536, 2048, 'A florist arranging pastel wedding flowers on a stone pedestal in a sunlit room'),
  wedding07: photo('/assets/weddings/wedding-07.jpg', 1536, 2048, 'A florist carrying a large wedding flower arrangement towards the venue'),
  wedding09: photo('/assets/weddings/wedding-09.jpg', 1536, 2048, 'A florist carrying green, white and pale yellow wedding flowers outside a brick venue'),
  spray: photo('/assets/sympathy-spray.jpg', 1081, 1280, 'A white and green funeral spray made by Bramble & Petal'),
  tribute: photo('/assets/sympathy-tribute.jpg', 1179, 1095, 'Floral tributes with white lettering and sympathy arrangements prepared for a farewell'),
  handTied: photo('/assets/studio-work-2.jpg', 936, 1280, 'A hand-tied white bouquet with green eucalyptus'),
  workbench: photo('/assets/studio-work-4.jpg', 960, 1280, 'Pale yellow and lilac flowers gathered on the studio workbench'),
  consultations: photo('/assets/studio-consultations.jpg', 1280, 960, 'The wooden Bramble & Petal consultation studio'),
};

// A service page: the photo at the top, then one spot beside each of its
// three sections (see app/public/service-page.tsx). Removing the top photo
// shows the designed B & P panel instead; removing a section photo leaves that
// section as text only.
const pageSpots = (top: SitePhoto | null, sections: [string, SitePhoto | null][]): Spot[] => [
  { name: 'Top of the page', photo: top, ...!top && { empty: 'The green B & P panel shows here instead.' } },
  ...sections.map(([heading, image]): Spot => ({ name: `Beside “${heading}”`, photo: image, empty: 'This section shows text only.' })),
];
const PAGE_WHERE = 'The photo at the top, and one beside each section further down. Remove a section photo and that section shows text only.';

export const SITE_GALLERIES = {
  'home-banner': { page: 'Homepage', kind: 'spots', title: 'Top banner', where: 'The large photo at the top of the homepage.', tip: 'A wide (landscape) photo works best here.', href: '/', alt: WEDDING_ALT, spots: [{ name: 'Banner', photo: p.hero }] },
  'home-welcome': { page: 'Homepage', kind: 'spots', title: 'Welcome', where: 'Beside “Thoughtful flowers, for every occasion.”', href: '/#about', alt: DEFAULT_PHOTO_ALT, spots: [{ name: 'Welcome photo', photo: p.pedestal }] },
  'home-services': { page: 'Homepage', kind: 'spots', title: 'Service cards', where: 'The cards linking to Weddings, Funerals and Everyday flowers. The Corporate card has no photo.', href: '/#services', alt: DEFAULT_PHOTO_ALT, spots: [
    { name: 'Weddings card', photo: p.bridalParty, position: '50% 66%' },
    { name: 'Funerals card', photo: p.spray },
    { name: 'Everyday flowers card', photo: p.handTied },
  ] },
  'home-weddings': { page: 'Homepage', kind: 'spots', title: 'Wedding collection', where: 'The three photos under “Entirely yours. From the first stem.”', href: '/#weddings', alt: WEDDING_ALT, spots: [
    { name: 'Large photo', photo: p.wedding02 },
    { name: 'Top right', photo: p.sunlit },
    { name: 'Small framed photo', photo: p.flowerGirl },
  ] },
  'home-studio': { page: 'Homepage', kind: 'spots', title: 'Inside our studio', where: 'The two photos beside “From our hands, to your moments.”', href: '/#studio', alt: DEFAULT_PHOTO_ALT, spots: [
    { name: 'Large photo', photo: p.creating },
    { name: 'Small framed photo', photo: p.arriving },
  ] },
  'home-remembrance': { page: 'Homepage', kind: 'spots', title: 'Flowers in remembrance', where: 'Beside “Flowers created with care.”', href: '/#sympathy', alt: FUNERAL_ALT, spots: [{ name: 'Remembrance photo', photo: p.tribute }] },
  home: { page: 'Homepage', kind: 'gallery', title: 'A closer look', where: 'The row of photos under “Nature, beautifully considered.” near the bottom.', href: '/#work', alt: DEFAULT_PHOTO_ALT, max: 8, defaults: [p.workbench, p.pedestal, p.consultations] },
  'weddings-page': { page: 'Weddings', kind: 'spots', title: 'Page photos', where: PAGE_WHERE, href: '/weddings', alt: WEDDING_ALT, spots: pageSpots(p.bridalParty, [['The flowers you carry.', p.flowerGirl], ['A sense of occasion.', p.pedestal], ['From ceremony to celebration.', null]]) },
  weddings: { page: 'Weddings', kind: 'gallery', title: 'Gallery', where: 'The “A closer look at our work” gallery. Visitors can tap a photo to see it larger.', href: '/weddings#wedding-gallery', alt: WEDDING_ALT, max: 40,
    defaults: [p.celebration, p.bridalParty, p.flowerGirl, p.pedestal, p.sunlit, p.creating, p.arriving, p.wedding02, p.wedding03, p.wedding04, p.wedding05, p.wedding07, p.wedding09] },
  'funerals-page': { page: 'Funerals', kind: 'spots', title: 'Page photos', where: PAGE_WHERE, href: '/funerals', alt: FUNERAL_ALT, spots: pageSpots(p.spray, [['Something meaningful.', p.tribute], ['The right shape and scale.', null], ['The details, taken care of.', null]]) },
  'flowers-page': { page: 'Everyday flowers', kind: 'spots', title: 'Page photos', where: PAGE_WHERE, href: '/flowers', alt: DEFAULT_PHOTO_ALT, spots: pageSpots(p.handTied, [['Made for the person.', null], ['Something to look forward to.', null], ['Collection or delivery.', null]]) },
  'corporate-page': { page: 'Corporate', kind: 'spots', title: 'Page photos', where: 'The top of the page shows the green B & P panel until you add a photo. You can also add one beside each section.', href: '/corporate', alt: 'Corporate and event flowers by Bramble & Petal, florist in Southampton and the New Forest', spots: pageSpots(null, [['A fresh welcome.', null], ['A gathering, considered.', null], ['Flowers on your schedule.', null]]) },
  'our-studio-page': { page: 'Our studio', kind: 'spots', title: 'Page photos', where: PAGE_WHERE, href: '/our-studio', alt: DEFAULT_PHOTO_ALT, spots: pageSpots(p.creating, [['First, a conversation.', p.consultations], ['Chosen with the season.', p.workbench], ['Made with attention.', null]]) },
  'client-studio-page': { page: 'Client Studio', kind: 'spots', title: 'Page photos', where: 'The photo at the top of the Client Studio page.', href: '/client-studio', alt: DEFAULT_PHOTO_ALT, spots: [{ name: 'Top of the page', photo: p.pedestal }] },
} satisfies Record<string, GalleryDefinition>;

export type GalleryKey = keyof typeof SITE_GALLERIES;
export const GALLERY_KEYS = Object.keys(SITE_GALLERIES) as GalleryKey[];
export const isGalleryKey = (value: unknown): value is GalleryKey => typeof value === 'string' && Object.hasOwn(SITE_GALLERIES, value);
const definition = (key: GalleryKey): GalleryDefinition => SITE_GALLERIES[key];

/** The photos a section shows before it is ever saved in the Studio. */
export const defaultPhotos = (key: GalleryKey): SectionPhotos => { const section = definition(key); return section.kind === 'gallery' ? section.defaults : section.spots.map(spot => spot.photo); };

// Photos already in the website's code that Jade can use anywhere.
export const BUILT_IN_PHOTOS: SitePhoto[] = Object.values(p);

const UPLOADED = /^\/site-photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const uploadedPhotoId = (src: string) => UPLOADED.exec(src)?.[1] ?? null;
export const uploadedPhotoSrc = (id: string) => `/site-photos/${id}`;

export class GalleryError extends Error {}
const dimension = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10000 ? value : undefined;

// One photo from the Studio. Descriptions aren't edited in the Studio: a
// built-in photo keeps its own, and an upload gets the section's.
function checkPhoto(key: GalleryKey, item: unknown): SitePhoto {
  if (!item || typeof item !== 'object' || typeof (item as SitePhoto).src !== 'string') throw new GalleryError('One of the photos could not be read. Reload and try again.');
  const { src, width, height } = item as SitePhoto;
  const builtIn = BUILT_IN_PHOTOS.find(photo => photo.src === src);
  if (builtIn) return { ...builtIn };
  if (!uploadedPhotoId(src)) throw new GalleryError('One of the photos is not from the website or the Studio. Reload and try again.');
  const photo: SitePhoto = { src, alt: definition(key).alt };
  const w = dimension(width), h = dimension(height);
  if (w && h) { photo.width = w; photo.height = h; }
  return photo;
}

/** Checks a section's photos from the Studio and returns them to save, in order. */
export function validateGalleryPhotos(key: GalleryKey, value: unknown): SectionPhotos {
  const section = definition(key);
  if (!Array.isArray(value)) throw new GalleryError('Send the list of photos to show.');
  if (section.kind === 'spots') {
    if (value.length !== section.spots.length) throw new GalleryError('The photos could not be read. Reload and try again.');
    return section.spots.map((spot, index) => {
      if (value[index] !== null) return checkPhoto(key, value[index]);
      if (spot.empty) return null;
      throw new GalleryError(`${section.spots.length > 1 ? spot.name : section.title} needs a photo. Choose one before saving.`);
    });
  }
  if (value.length > section.max) throw new GalleryError(`${section.title} can show up to ${section.max} photos. Remove some before saving.`);
  const seen = new Set<string>();
  return value.map(item => {
    const photo = checkPhoto(key, item);
    if (seen.has(photo.src)) throw new GalleryError('The same photo appears twice. Remove one copy before saving.');
    seen.add(photo.src);
    return photo;
  });
}

/**
 * A saved section as the website shows it. A saved photo that no longer checks
 * out (say, a built-in photo since deleted from the code) is skipped in a
 * gallery, and a spot that must have a photo falls back to its starting one.
 */
export function storedGalleryPhotos(key: GalleryKey, value: unknown): SectionPhotos {
  const section = definition(key);
  const read = (item: unknown) => { try { return checkPhoto(key, item); } catch { return undefined; } };
  if (!Array.isArray(value)) return defaultPhotos(key);
  if (section.kind === 'gallery') return value.flatMap(item => read(item) ?? []).slice(0, section.max);
  return section.spots.map((spot, index) => value[index] === null && spot.empty ? null : read(value[index]) ?? spot.photo);
}

// The homepage strip shows rows of four on desktop and pairs on phones; a
// shorter last row stretches its photos to fill the width (see public-site.css).
export function stripPhotoSizes(index: number, count: number) {
  const row = Math.floor(index / 4), lastRow = Math.floor((count - 1) / 4);
  const perRow = row < lastRow ? 4 : count - lastRow * 4;
  const phone = count % 2 === 1 && index === count - 1 ? 100 : 50;
  return `(max-width: 700px) ${phone}vw, ${Math.ceil(100 / perRow)}vw`;
}

/** A gallery's photos, without the gaps an optional spot can leave. */
export const presentPhotos = (list: SectionPhotos) => list.filter((photo): photo is SitePhoto => photo !== null);

/** How a spot frames its photo: its own framing for the starting photo, centred for any other. */
export function spotPosition(key: GalleryKey, index: number, photo: SitePhoto) {
  const section = definition(key);
  const spot = section.kind === 'spots' ? section.spots[index] : undefined;
  return spot?.position && spot.photo?.src === photo.src ? spot.position : 'center';
}
