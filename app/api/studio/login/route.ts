import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const studioUsername = process.env.STUDIO_USERNAME || 'jade';
  const studioEmail = process.env.STUDIO_EMAIL;
  const studioPassword = process.env.STUDIO_PASSWORD;

  if (!studioEmail || !studioPassword) {
    return NextResponse.json({ error: 'Studio login has not been configured yet.' }, { status: 503 });
  }

  if (username !== studioUsername || password !== studioPassword) {
    return NextResponse.json({ error: 'That username or password is not correct.' }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: studioEmail, password: studioPassword });
  if (error) {
    console.error('[studio login] Supabase sign-in failed', error.message);
    return NextResponse.json({ error: 'Studio sign-in is not ready yet. Check the Studio account setup.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
