import type { Metadata } from 'next';
import ClientPortal from './portal';
export const metadata: Metadata = { title: 'Your floral plan', robots: { index: false, follow: false } };
export default function Page() { return <ClientPortal />; }
