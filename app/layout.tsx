import type { Metadata } from 'next';
import './globals.css';
import './enquiry-form.css';
import './experience-refresh.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bramblesandpetals.co.uk'),
  title: { default: 'Bramble & Petal | Florist Studio', template: '%s | Bramble & Petal' },
  description: 'Thoughtful, seasonal flowers for weddings, farewells, events and meaningful everyday moments.',
  openGraph: {
    title: 'Bramble & Petal Florist Studio',
    description: 'Thoughtful, seasonal flowers for weddings, farewells, events and meaningful everyday moments.',
    type: 'website',
    images: [{ url: '/images/hero.jpg', width: 1680, height: 945, alt: 'Bramble & Petal florist holding a bouquet in the flower studio' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
