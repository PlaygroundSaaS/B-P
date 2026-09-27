import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
import WeddingGallery from '../wedding-gallery';
import { loadSitePhotos } from '@/lib/site-photos-server';
import { presentPhotos } from '@/lib/site-photos';
export const metadata = pageMetadata('/weddings');
// Photos and the gallery are chosen in the Studio; saving there refreshes this page straight away.
export const revalidate = 300;
const content = {
  "title": "Wedding flowers in Southampton, the New Forest & Hampshire.",
  "label": "THE WEDDING COLLECTION",
  "intro": "From our Southampton studio to wedding venues across the New Forest and Hampshire, we create flowers around your day. From the bouquet in your hands to the flowers that welcome your guests. Designed around your venue, your season and your way of celebrating.",
  "occasion": "Wedding",
  "closing": "Tell us about your day.",
  "sections": [
    {
      "title": "The flowers you carry.",
      "text": "Bouquets, buttonholes and flower crowns, considered together. We’ll explore your colours, favourite flowers and the details that feel like you."
    },
    {
      "title": "A sense of occasion.",
      "text": "Ceremony arrangements that work with the architecture of your venue. We’ll consider scale, placement and how flowers can be enjoyed throughout the day."
    },
    {
      "title": "From ceremony to celebration.",
      "text": "A joined-up plan for your reception flowers, tables and finishing touches. Your proposal brings together the arrangements, setup details and investment before you decide."
    }
  ]
};
export default async function Page() {
  const photos = await loadSitePhotos(), gallery = presentPhotos(photos.weddings);
  return <ServicePage content={content} photos={photos['weddings-page']} path='/weddings'>{gallery.length > 0 && <section className="public-wrap public-full-portfolio" id="wedding-gallery"><p className="public-kicker">REAL WEDDINGS, REAL DETAILS</p><h2>A closer look at our work.</h2><WeddingGallery images={gallery}/></section>}</ServicePage>;
}
