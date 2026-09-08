import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { clientSession, clearClientSession } from '@/lib/client-auth';
import { readJsonObject, requireSameOrigin } from '@/lib/request-body';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const body = await readJsonObject(request, 1024);
    const [id, token, ...extra] = String(body.invite || '').split('.');
    if (extra.length || !/^[a-f0-9-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) return json({ error: 'This invitation is not valid. Ask the studio for a new link.' }, 401);
    const db = createStudioDatabaseClient(); if (!db) return json({ error: 'Please try again shortly.' }, 503);
    const { data } = await db.from('studio_client_access').select('id,token_hash').eq('workspace_key', STUDIO_WORKSPACE).eq('id', id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    const received = createHash('sha256').update(token).digest('hex');
    if (!data || data.token_hash.length !== received.length || !timingSafeEqual(Buffer.from(received), Buffer.from(data.token_hash))) return json({ error: 'This invitation has expired or is no longer available. Please contact the studio.' }, 401);
    const response = json({ signedIn: true }); response.cookies.set(clientSession(id)); return response;
  } catch { return json({ error: 'Unable to open your invitation. Please try again.' }, 400); }
}
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); const response = json({ signedOut: true }); response.cookies.set(clearClientSession()); return response; } catch { return json({ error: 'Please sign out from your plan page.' }, 403); }
}
