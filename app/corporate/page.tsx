import type { Metadata } from 'next';
import ServicePage from '../public/service-page';
export const metadata: Metadata = { title: "Corporate & Hospitality", description: "For the first impression, the gathering and the everyday. Floral design considered around your space, your brand and the people who use it.", alternates: { canonical: '/corporate' } };
const content = {
  "title": "Flowers for welcoming spaces.",
  "label": "CORPORATE & HOSPITALITY",
  "intro": "For the first impression, the gathering and the everyday. Floral design considered around your space, your brand and the people who use it.",
  "occasion": "Corporate event",
  "closing": "Let’s talk about your space.",
  "sections": [
    {
      "title": "A fresh welcome.",
      "text": "Reception desks, meeting spaces, restaurants and hospitality settings. We’ll discuss colour, scale and practical placement to find an arrangement that belongs."
    },
    {
      "title": "A gathering, considered.",
      "text": "Flowers for events, launches and special occasions, with a clear plan for installation, timings and collection where needed."
    },
    {
      "title": "Flowers on your schedule.",
      "text": "Explore weekly, fortnightly, monthly or event-based arrangements. Tell us about the location and frequency you have in mind so we can confirm a suitable plan."
    }
  ]
};
export default function Page() { return <ServicePage content={content}></ServicePage>; }
