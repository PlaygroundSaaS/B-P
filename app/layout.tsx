import type { Metadata } from 'next';
import './globals.css';
import './enquiry-form.css';
import './experience-refresh.css';
import './site-audit.css';
import './atelier.css';
import './public-site.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bramblesandpetals.co.uk'),
  title: { default: 'Bramble & Petal | Florist Studio', template: '%s | Bramble & Petal' },
  description: 'Thoughtful, seasonal flowers for weddings, farewells, events and meaningful everyday moments.',
  openGraph: {
    title: 'Bramble & Petal Florist Studio',
    description: 'Thoughtful, seasonal flowers for weddings, farewells, events and meaningful everyday moments.',
    type: 'website',
    images: [{ url: '/assets/weddings/ceremony-celebration.webp', width: 678, height: 1030, alt: 'Wedding flowers by Bramble & Petal in a light-filled ceremony room' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

