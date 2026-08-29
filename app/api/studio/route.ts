import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { blankData, reviveData } from '@/lib/studio-data';
import { hasStudioSession } from '@/lib/studio-auth';

export const runtime = 'nodejs';

const WORKSPACE_KEY = 'bramble-petal-main';

function createStudioDatabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function GET() {
  if (!await hasStudioSession()) {
    return NextResponse.json({ error: 'Please sign in to open your Studio.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase server access is not configured.' }, { status: 503 });
    }
    const { data, error } = await supabase
      .from('studio_app_state')
      .select('data, updated_at')
      .eq('workspace_key', WORKSPACE_KEY)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      data: reviveData(data?.data ?? blankData()),
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error('[studio] database read failed', error);
    return NextResponse.json({ error: 'The Studio database could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await hasStudioSession()) {
    return NextResponse.json({ error: 'Please sign in to save changes.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase server access is not configured.' }, { status: 503 });
    }
    const body = await request.json() as { data?: unknown; expectedUpdatedAt?: unknown };
    const incoming = reviveData(body?.data ?? body);
    const expectedUpdatedAt = typeof body?.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null;
    const updatedAt = new Date().toISOString();
    if (expectedUpdatedAt) {
      const { data, error } = await supabase
        .from('studio_app_state')
        .update({ data: incoming, updated_at: updatedAt })
        .eq('workspace_key', WORKSPACE_KEY)
        .eq('updated_at', expectedUpdatedAt)
        .select('updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'The Studio changed in another tab or device. Refresh before saving again.' }, { status: 409 });
      }
    } else {
      const { error } = await supabase.from('studio_app_state').upsert({
        workspace_key: WORKSPACE_KEY,
        data: incoming,
        updated_at: updatedAt,
      }, { onConflict: 'workspace_key' });
      if (error) throw error;
    }
    return NextResponse.json({ data: incoming, updatedAt });
  } catch (error) {
    console.error('[studio] database save failed', error);
    return NextResponse.json({ error: 'Your change could not be saved to the Studio database.' }, { status: 503 });
  }
}
