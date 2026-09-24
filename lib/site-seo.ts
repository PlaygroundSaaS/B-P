import type { Metadata } from 'next';
export const SITE_URL = 'https://www.bramblesandpetals.co.uk';
export const BUSINESS_NAME = 'Bramble & Petal';
export const BUSINESS_ID = `${SITE_URL}/#business`;
export const PHONE_DISPLAY = '07495 335388';
export const PHONE_E164 = '+447495335388';
const AREAS_SERVED = [{ '@type': 'City', name: 'Southampton' }, { '@type': 'Place', name: 'New Forest' }, { '@type': 'AdministrativeArea', name: 'Hampshire' }];
export const publicPages = {
  '/': { title: 'Southampton & New Forest Florist | Wedding & Funeral Flowers', description: 'Bramble & Petal is a Southampton and New Forest florist creating wedding flowers, funeral tributes, seasonal bouquets and corporate arrangements. Enquire with Jade.', image: '/assets/weddings/wedding-hero-wide.webp', imageAlt: 'Wedding couple surrounded by pastel floral arrangements', label: 'Home' },
  '/weddings': { title: 'Wedding Flowers Southampton, New Forest & Hampshire', description: 'Wedding flowers across Southampton, the New Forest and Hampshire: bridal bouquets, buttonholes, ceremony designs and reception flowers, created by Bramble & Petal.', image: '/assets/weddings/bridal-party-bouquets.webp', imageAlt: 'Bride and bridesmaid with coordinating wedding bouquets', label: 'Wedding flowers' },
  '/funerals': { title: 'Funeral Flowers Southampton, New Forest & Hampshire', description: 'Funeral flowers across Southampton, the New Forest and Hampshire. Discuss wreaths, sprays, hearts and personal tributes with Jade at Bramble & Petal.', image: '/assets/sympathy-spray.jpg', imageAlt: 'White and green funeral flower spray', label: 'Funeral flowers' },
  '/corporate': { title: 'Corporate & Event Flowers Southampton, New Forest & Hampshire', description: 'Corporate flowers across Southampton, the New Forest and Hampshire for offices, hospitality, launches and events. Ask Bramble & Petal about one-off designs and regular floral arrangements.', image: '/assets/brand-logo.png', imageAlt: 'Bramble & Petal Florist Studio', label: 'Corporate flowers' },
  '/flowers': { title: 'Bouquets & Regular Flowers Southampton & New Forest', description: 'Seasonal bouquets and regular flowers in Southampton and the New Forest for gifts, celebrations, home and work. Enquire about collection, delivery, availability and your budget.', image: '/assets/bouquet-04.jpg', imageAlt: 'Peach, cream and blush rose bouquet', label: 'Bouquets & regular flowers' },
  '/our-studio': { title: 'Meet Jade | Southampton & New Forest Florist', description: 'Meet Jade at Bramble & Petal, a Southampton and New Forest florist creating personal flowers for weddings, farewells and everyday moments. Consultations by arrangement.', image: '/assets/weddings/creating-wedding-flowers.webp', imageAlt: 'Florist arranging wedding flowers by hand', label: 'Our studio' },
  '/client-studio': { title: 'Flower Consultations Southampton | Client Studio', description: 'Start your wedding, funeral or corporate flower consultation with Bramble & Petal in Southampton. Share your ideas and review your private floral plan.', image: '/assets/weddings/pastel-pedestal-details.webp', imageAlt: 'Cream and lilac wedding flower arrangement', label: 'Client Studio' },
  '/contact': { title: 'Contact Your Southampton & New Forest Florist', description: 'Call or enquire with Bramble & Petal in Southampton and the New Forest about wedding flowers, funeral tributes, corporate designs or bouquets. Share your date, location and ideas.', image: '/assets/brand-logo.png', imageAlt: 'Bramble & Petal Florist Studio', label: 'Contact' },
  '/privacy': { title: 'Privacy Policy', description: 'How Bramble & Petal uses enquiry information, private floral plans and client reviews, and how to contact the studio about your information.', image: '/assets/brand-logo.png', imageAlt: 'Bramble & Petal Florist Studio', label: 'Privacy' },
} as const;
export type PublicPath = keyof typeof publicPages;
export function pageMetadata(path: PublicPath): Metadata {
  const page = publicPages[path]; const title = `${page.title} | ${BUSINESS_NAME}`;
  return { title: { absolute: title }, description: page.description, alternates: { canonical: path },
    openGraph: { title, description: page.description, url: path, siteName: BUSINESS_NAME, locale: 'en_GB', type: 'website', images: [{ url: page.image, alt: page.imageAlt }] },
    twitter: { card: 'summary_large_image', title, description: page.description, images: [page.image] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  };
}
export const businessSchema = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Florist', '@id': BUSINESS_ID, name: BUSINESS_NAME, alternateName: ['Bramble & Petal Florist Studio', 'Brambles and Petals', 'Brambles & Petals'], url: `${SITE_URL}/`, logo: `${SITE_URL}/assets/brand-logo.png`, image: `${SITE_URL}/assets/weddings/wedding-hero-wide.webp`, email: 'info@bramblesandpetals.co.uk', telephone: PHONE_E164, description: 'Southampton and New Forest florist creating wedding flowers, funeral tributes, seasonal bouquets and corporate arrangements across Hampshire.', areaServed: AREAS_SERVED, contactPoint: { '@type': 'ContactPoint', email: 'info@bramblesandpetals.co.uk', telephone: PHONE_E164, areaServed: 'GB', contactType: 'customer enquiries', availableLanguage: 'English' } },
  { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: BUSINESS_NAME, alternateName: ['Bramble & Petal Florist Studio', 'Brambles and Petals'], inLanguage: 'en-GB', publisher: { '@id': BUSINESS_ID } },
] };
export function serviceSchema(path: PublicPath) {
  const page = publicPages[path];
  return { '@context': 'https://schema.org', '@type': 'Service', '@id': `${SITE_URL}${path}#service`, name: page.label, description: page.description, url: `${SITE_URL}${path}`, provider: { '@id': BUSINESS_ID }, areaServed: AREAS_SERVED };
}
export function breadcrumbSchema(path: PublicPath) { return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: publicPages[path].label, item: `${SITE_URL}${path}` }] }; }
