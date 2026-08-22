import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'bramble_petal_studio_session';
const SESSION_SECONDS = 60 * 60 * 24 * 14;

const sessionSecret = () => process.env.AUTH_SECRET || process.env.STUDIO_PASSWORD || '';
const signature = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

const same = (left: string, right: string) => {
  const secret = sessionSecret();
  if (!secret) return false;
  const leftHash = signature(left, secret);
  const rightHash = signature(right, secret);
  return timingSafeEqual(Buffer.from(leftHash), Buffer.from(rightHash));
};

export const studioLoginConfigured = () => Boolean(process.env.STUDIO_PASSWORD && sessionSecret());

export const validStudioCredentials = (username: string, password: string) => {
  const expectedUsername = process.env.STUDIO_USERNAME || 'jade';
  const expectedPassword = process.env.STUDIO_PASSWORD || '';
  return studioLoginConfigured() && same(username.trim(), expectedUsername) && same(password, expectedPassword);
};

export const createStudioSession = () => {
  const secret = sessionSecret();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
};

export const studioSessionCookie = (value: string) => ({
  name: COOKIE_NAME,
  value,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_SECONDS,
});

export const clearStudioSessionCookie = () => ({ ...studioSessionCookie(''), maxAge: 0 });

export const hasStudioSession = async () => {
  const secret = sessionSecret();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !token) return false;
  const [payload, receivedSignature, ...extra] = token.split('.');
  if (!payload || !receivedSignature || extra.length) return false;
  if (!same(receivedSignature, signature(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
};
