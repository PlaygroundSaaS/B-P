import { NextResponse } from 'next/server';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { createStudioSession, studioLoginConfigured, studioSessionCookie, validStudioCredentials } from '@/lib/studio-auth';
import { loginAllowed, recordLoginFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    requireSameOrigin(request);
    body = await readJsonObject(request, 8192);
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!studioLoginConfigured()) {
    return NextResponse.json({ error: 'Studio login has not been configured yet.' }, { status: 503 });
  }

  if (!(await loginAllowed(request))) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }, { status: 429, headers: { 'Retry-After': '900' } });
  }

  if (!validStudioCredentials(username, password)) {
    await recordLoginFailure(request);
    return NextResponse.json({ error: 'That username or password is not correct.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set(studioSessionCookie(createStudioSession()));
  return response;
}

