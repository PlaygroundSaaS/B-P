import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
import WeddingGallery from '../wedding-gallery';
import { weddingImages } from '../public/wedding-images';
export const metadata = pageMetadata('/weddings');
const content = {
  "title": "Wedding flowers in Southampton & Hampshire.",
  "label": "THE WEDDING COLLECTION",
  "intro": "From our Southampton studio to wedding venues across Hampshire, we create flowers around your day. From the bouquet in your hands to the flowers that welcome your guests. Designed around your venue, your season and your way of celebrating.",
  "image": "/assets/weddings/bridal-party-bouquets.webp",
  "alt": "Bride and bridesmaid holding coordinating Bramble & Petal bouquets",
  "occasion": "Wedding",
  "closing": "Tell us about your day.",
  "sections": [
    {
      "title": "The flowers you carry.",
      "text": "Bouquets, buttonholes and flower crowns, considered together. We’ll explore your colours, favourite flowers and the details that feel like you.",
      "image": "/assets/weddings/flower-girl-crown.webp",
      "alt": "Flower girl wearing a white flower crown with a petal basket"
    },
    {
      "title": "A sense of occasion.",
      "text": "Ceremony arrangements that work with the architecture of your venue. We’ll consider scale, placement and how flowers can be enjoyed throughout the day.",
      "image": "/assets/weddings/pastel-pedestal-details.webp",
      "alt": "Cream, lilac and green wedding flowers beside a venue window"
    },
    {
      "title": "From ceremony to celebration.",
      "text": "A joined-up plan for your reception flowers, tables and finishing touches. Your proposal brings together the arrangements, setup details and investment before you decide."
    }
  ]
};
export default function Page() { return <ServicePage content={content} path='/weddings'><section className="public-wrap public-full-portfolio"><p className="public-kicker">REAL WEDDINGS, REAL DETAILS</p><h2>A closer look at our work.</h2><WeddingGallery images={weddingImages} showCaptions={false}/></section></ServicePage>; }
