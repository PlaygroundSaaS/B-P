import { SITE_URL } from '@/lib/site-seo';
import type { Metadata } from 'next';
import './globals.css';
import './enquiry-form.css';
import './experience-refresh.css';
import './site-audit.css';
import './atelier.css';
import './public-site.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Bramble & Petal | Southampton Florist', template: '%s | Bramble & Petal' },
  description: 'Southampton florist creating wedding flowers, funeral tributes, seasonal bouquets and corporate arrangements.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

