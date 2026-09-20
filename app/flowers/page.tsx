import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
export const metadata = pageMetadata('/flowers');
const content = {
  "title": "Seasonal bouquets in Southampton.",
  "label": "EVERYDAY & REGULAR FLOWERS",
  "intro": "Flowers from our Southampton studio for a thank you, a celebration or simply something lovely for the room. Seasonal flowers, arranged with the same care as every occasion we create for.",
  "image": "/assets/studio-work-2.jpg",
  "alt": "Hand-tied white flowers and eucalyptus prepared in the studio",
  "occasion": "Everyday flowers",
  "closing": "A little joy starts here.",
  "sections": [
    {
      "title": "Made for the person.",
      "text": "Tell us your preferred colours, occasion and budget. We’ll confirm what is in season and create an arrangement around your brief.",
      "image": "/assets/bouquet-04.jpg",
      "alt": "A bouquet of peach, cream and blush roses"
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
export default function Page() { return <ServicePage content={content} path='/flowers'></ServicePage>; }
