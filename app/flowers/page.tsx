import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
import { loadSitePhotos } from '@/lib/site-photos-server';
export const metadata = pageMetadata('/flowers');
// Photos are chosen in the Studio; saving there refreshes this page straight away.
export const revalidate = 300;
const content = {
  "title": "Seasonal bouquets in Southampton & the New Forest.",
  "label": "EVERYDAY & REGULAR FLOWERS",
  "intro": "Flowers from our Southampton studio for homes and workplaces across the New Forest and Hampshire. For a thank you, a celebration or simply something lovely for the room. Seasonal flowers, arranged with the same care as every occasion we create for.",
  "occasion": "Everyday flowers",
  "closing": "A little joy starts here.",
  "sections": [
    {
      "title": "Made for the person.",
      "text": "Tell us your preferred colours, occasion and budget. We’ll confirm what is in season and create an arrangement around your brief."
    },
    {
      "title": "Something to look forward to.",
      "text": "For home or work, ask us about regular flowers. We’ll agree the frequency, style and delivery arrangements with you before anything is booked."
    },
    {
      "title": "Collection or delivery.",
      "text": "Include your preferred date and delivery area in your enquiry. We’ll confirm availability, timing and any delivery cost directly."
    }
  ]
};
export default async function Page() {
  const photos = await loadSitePhotos();
  return <ServicePage content={content} photos={photos['flowers-page']} path='/flowers' />;
}
