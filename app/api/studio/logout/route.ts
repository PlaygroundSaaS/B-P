import { NextResponse } from 'next/server';
import { requireSameOrigin, RequestError } from '@/lib/request-body';
import { clearStudioSessionCookie } from '@/lib/studio-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return NextResponse.json({ error: 'Please sign out from the Studio.' }, { status: error instanceof RequestError ? error.status : 400 }); }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearStudioSessionCookie());
  return response;
}

