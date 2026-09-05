import StudioClient from './studio-client';
import StudioAppearance from './studio-appearance';
import StudioLoginForm from './login-form';
import { hasStudioSession } from '@/lib/studio-auth';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  return await hasStudioSession() ? <StudioAppearance><StudioClient /></StudioAppearance> : <StudioLoginForm />;
}

