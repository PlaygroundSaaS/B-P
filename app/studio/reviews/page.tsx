import { redirect } from 'next/navigation';

export const metadata = { title: 'Client reviews · Studio', robots: { index: false, follow: false } };
export default function Page() { redirect('/studio#business/reviews'); }
