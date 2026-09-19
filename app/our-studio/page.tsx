import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
export const metadata: Metadata = { title: "Inside Bramble & Petal", description: "A place for conversations, seasonal flowers and careful making. Jade brings your ideas together, from the first inspiration to the final arrangement.", alternates: { canonical: '/our-studio' } };
const content = {
  "title": "From our hands, to your moments.",
  "label": "INSIDE BRAMBLE & PETAL",
  "intro": "A place for conversations, seasonal flowers and careful making. Jade brings your ideas together, from the first inspiration to the final arrangement.",
  "image": "/assets/weddings/creating-wedding-flowers.webp",
  "alt": "Florist arranging wedding flowers by hand in the studio",
  "occasion": "Other",
  "closing": "Come with an idea. We’ll grow it together.",
  "sections": [
    {
      "title": "First, a conversation.",
      "text": "A favourite colour, the feeling of a space, a person you’re celebrating. We listen before we design, and studio consultations are arranged around your occasion.",
      "image": "/assets/studio-consultations.jpg",
      "alt": "The Bramble & Petal consultation studio with chairs and floral work"
    },
    {
      "title": "Chosen with the season.",
      "text": "We consider shape, movement and colour together, working with available flowers and discussing alternatives where a particular stem is important to you.",
      "image": "/assets/studio-work-4.jpg",
      "alt": "Pale yellow and lilac flowers on the studio workbench"
    },
    {
      "title": "Made with attention.",
      "text": "Flowers are prepared, arranged and finished by hand. We plan delivery and setup alongside the design, so the practical details are part of the conversation from the start."
    }
  ]
};
export default function Page() { return <ServicePage content={content}></ServicePage>; }
