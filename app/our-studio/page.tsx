import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
import { loadSitePhotos } from '@/lib/site-photos-server';
export const metadata = pageMetadata('/our-studio');
// Photos are chosen in the Studio; saving there refreshes this page straight away.
export const revalidate = 300;
const content = {
  "title": "Meet Jade, your Southampton & New Forest florist.",
  "label": "INSIDE BRAMBLE & PETAL",
  "intro": "Our Southampton studio is a place for conversations, seasonal flowers and careful making. Jade brings your ideas together, from the first inspiration to the final arrangement.",
  "occasion": "Other",
  "closing": "Come with an idea. We’ll grow it together.",
  "sections": [
    {
      "title": "First, a conversation.",
      "text": "A favourite colour, the feeling of a space, a person you’re celebrating. We listen before we design, and studio consultations are arranged around your occasion."
    },
    {
      "title": "Chosen with the season.",
      "text": "We consider shape, movement and colour together, working with available flowers and discussing alternatives where a particular stem is important to you."
    },
    {
      "title": "Made with attention.",
      "text": "Flowers are prepared, arranged and finished by hand. We plan delivery and setup alongside the design, so the practical details are part of the conversation from the start."
    }
  ]
};
export default async function Page() {
  const photos = await loadSitePhotos();
  return <ServicePage content={content} photos={photos['our-studio-page']} path='/our-studio' />;
}
