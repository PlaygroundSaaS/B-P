import StudioClient from './studio-client';
import StudioLoginForm from './login-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  return auth.user ? <StudioClient /> : <StudioLoginForm />;
}
