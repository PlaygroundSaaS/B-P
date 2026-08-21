import { NextResponse } from 'next/server';
import { blankData, reviveData } from '@/lib/studio-data';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: 'Please sign in to open your Studio.' }, { status: 401 });
    const { data, error } = await supabase.from('studio_state').select('data').eq('owner_id', auth.user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json(reviveData(data?.data ?? blankData()));
  } catch (error) {
    console.error('[studio] read failed', error);
    return NextResponse.json({ error: 'The Studio database is not available yet.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const incoming = reviveData(await request.json());
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: 'Please sign in to save changes.' }, { status: 401 });
    const { error } = await supabase.from('studio_state').upsert({ owner_id: auth.user.id, data: incoming, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    if (error) throw error;
    return NextResponse.json(incoming);
  } catch (error) {
    console.error('[studio] save failed', error);
    return NextResponse.json({ error: 'Your change could not be saved to the Studio database.' }, { status: 503 });
  }
}

