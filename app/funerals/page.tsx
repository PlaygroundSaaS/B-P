import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
import { loadSitePhotos } from '@/lib/site-photos-server';
export const metadata = pageMetadata('/funerals');
// Photos are chosen in the Studio; saving there refreshes this page straight away.
export const revalidate = 300;
const content = {
  "title": "Funeral flowers, created with care.",
  "label": "FUNERAL & SYMPATHY FLOWERS",
  "intro": "Personal funeral flowers for Southampton, the New Forest and Hampshire, thoughtfully made. We’ll help you choose flowers that reflect the person being remembered and arrange the practical details with care.",
  "occasion": "Funeral flowers",
  "closing": "We’re here to help.",
  "sections": [
    {
      "title": "Something meaningful.",
      "text": "A favourite flower, a familiar colour or a tribute with personal significance. Share what matters to you; we can guide the choices from there."
    },
    {
      "title": "The right shape and scale.",
      "text": "Speak with us about sprays, wreaths, hearts, posies or bespoke tributes. We’ll discuss suitable flowers, the size of the arrangement and your budget."
    },
    {
      "title": "The details, taken care of.",
      "text": "Let us know the service date and delivery location. We’ll confirm timing and any arrangements needed with the venue or funeral director."
    }
  ]
};
export default async function Page() {
  const photos = await loadSitePhotos();
  return <ServicePage content={content} photos={photos['funerals-page']} path='/funerals' />;
}
