import { NextResponse } from 'next/server';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { isStudioData } from '@/lib/studio-validation';
const json: typeof NextResponse.json = (body, init) => NextResponse.json(body, { ...init, headers: { ...init?.headers, 'Cache-Control': 'private, no-store' } });
import { blankData, reviveData } from '@/lib/studio-data';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE as WORKSPACE_KEY } from '@/lib/studio-database';

export const runtime = 'nodejs';


export async function GET() {
  if (!await hasStudioSession()) {
    return json({ error: 'Please sign in to open your Studio.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return json({ error: 'The Studio is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    }
    const { data, error } = await supabase
      .from('studio_app_state')
      .select('data, updated_at')
      .eq('workspace_key', WORKSPACE_KEY)
      .maybeSingle();
    if (error) throw error;
    return json({
      data: reviveData(data?.data ?? blankData()),
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error('[studio] database read failed', error);
    return json({ error: 'The Studio database could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await hasStudioSession()) {
    return json({ error: 'Please sign in to save changes.' }, { status: 401 });
  }

  try {
    const supabase = createStudioDatabaseClient();
    if (!supabase) {
      console.error('[studio] Vercel Production is missing SUPABASE_SECRET_KEY');
      return json({ error: 'The Studio is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    }
    requireSameOrigin(request);
    const body = await readJsonObject(request, 4 * 1024 * 1024);
    if (!isStudioData(body.data) || !('expectedUpdatedAt' in body) || (body.expectedUpdatedAt !== null && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))))) {
      throw new RequestError('The saved records are incomplete or contain invalid values. Check your entries and try again.');
    }
    const incoming = reviveData(body.data);
    const expectedUpdatedAt = body.expectedUpdatedAt as string | null;
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
        return json({ error: 'The Studio changed in another tab or device. Refresh before saving again.' }, { status: 409 });
      }
    } else {
      const { error } = await supabase.from('studio_app_state').insert({
        workspace_key: WORKSPACE_KEY,
        data: incoming,
        updated_at: updatedAt,
      });
      if (error?.code === '23505') {
        return json({ error: 'The Studio already contains saved records. Refresh before saving again.' }, { status: 409 });
      }
      if (error) throw error;
    }
    return json({ data: incoming, updatedAt });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, { status: error.status });
    console.error('[studio] database save failed', error);
    return json({ error: 'Your change could not be saved to the Studio database.' }, { status: 503 });
  }
}

