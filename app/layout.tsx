import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bramble & Petal | Florist Studio',
  description: 'The Bramble & Petal florist studio hub.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

