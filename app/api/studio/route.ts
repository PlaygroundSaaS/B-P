import { NextResponse } from 'next/server';
import { blankData, reviveData } from '@/lib/studio-data';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE as WORKSPACE_KEY } from '@/lib/studio-database';

export const runtime = 'nodejs';


export async function GET() {
  if (!await hasStudioSession()) {
    return NextResponse.json({ error: 'Please sign in to open your Studio.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return NextResponse.json({ error: 'The Studio database key is missing from Vercel Production.' }, { status: 503 });
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
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return NextResponse.json({ error: 'The Studio database key is missing from Vercel Production.' }, { status: 503 });
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
      const { error } = await supabase.from('studio_app_state').insert({
        workspace_key: WORKSPACE_KEY,
        data: incoming,
        updated_at: updatedAt,
      });
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'The Studio already contains saved records. Refresh before saving again.' }, { status: 409 });
      }
      if (error) throw error;
    }
    return NextResponse.json({ data: incoming, updatedAt });
  } catch (error) {
    console.error('[studio] database save failed', error);
    return NextResponse.json({ error: 'Your change could not be saved to the Studio database.' }, { status: 503 });
  }
}
