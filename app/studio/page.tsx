import StudioClient from './studio-client';
import StudioLoginForm from './login-form';
import { hasStudioSession } from '@/lib/studio-auth';

export const metadata = { title: 'Studio Hub', robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  return await hasStudioSession() ? <StudioClient /> : <StudioLoginForm />;
}

