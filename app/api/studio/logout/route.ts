import { NextResponse } from 'next/server';
import { clearStudioSessionCookie } from '@/lib/studio-auth';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearStudioSessionCookie());
  return response;
}
