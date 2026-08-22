import { NextResponse } from 'next/server';
import { createStudioSession, studioLoginConfigured, studioSessionCookie, validStudioCredentials } from '@/lib/studio-auth';

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
  if (!studioLoginConfigured()) {
    return NextResponse.json({ error: 'Studio login has not been configured yet.' }, { status: 503 });
  }

  if (!validStudioCredentials(username, password)) {
    return NextResponse.json({ error: 'That username or password is not correct.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(studioSessionCookie(createStudioSession()));
  return response;
}
