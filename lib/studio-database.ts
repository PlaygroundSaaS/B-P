import { createClient } from '@supabase/supabase-js';

// Server routes only. Never expose this client or its key to browser code.
export const STUDIO_WORKSPACE = 'bramble-petal-main';
export function createStudioDatabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://ummnjohbbphzbshfbpgq.supabase.co';
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
