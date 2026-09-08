import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from './studio-database';
const name = 'bramble_petal_client_session';
const secret = () => process.env.AUTH_SECRET || process.env.STUDIO_PASSWORD || '';
const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');
export function clientSession(id: string) {
  const payload = Buffer.from(JSON.stringify({ id, role: 'client', exp: Date.now() + 7 * 86400000 })).toString('base64url');
  return { name, value: `${payload}.${sign(payload)}`, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 7 * 86400 };
}
export async function clientGrant() {
  const token = (await cookies()).get(name)?.value;
  if (!token || !secret()) return null;
  try {
    const [payload, signature, ...extra] = token.split('.');
    const expected = sign(payload);
    if (extra.length || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (value.role !== 'client' || typeof value.exp !== 'number' || value.exp < Date.now() || typeof value.id !== 'string') return null;
    const db = createStudioDatabaseClient(); if (!db) return null;
    const { data, error } = await db.from('studio_client_access').select('id,plan_id,client_id').eq('id', value.id).eq('workspace_key', STUDIO_WORKSPACE).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    return error ? null : data;
  } catch { return null; }
}
export const clearClientSession = () => ({ ...clientSession(''), value: '', maxAge: 0 });
