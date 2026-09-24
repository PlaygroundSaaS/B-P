import { createHmac } from 'node:crypto';
import { createStudioDatabaseClient } from './studio-database';

/**
 * Database-backed rate limits for the sign-in and public enquiry endpoints.
 * Serverless functions share no memory, so counts live in `studio_rate_events`
 * (server-only table). Visitor IP addresses are never stored: only a keyed hash.
 *
 * If the limiter itself is unavailable the request is allowed and the problem is
 * logged, so a database hiccup can never lock Jade out or lose a real enquiry.
 */
export const RATE_LIMITS = {
  loginPerVisitor: { bucket: 'login-failure', limit: 5, windowSeconds: 15 * 60 },
  loginEveryone: { bucket: 'login-failure-all', limit: 100, windowSeconds: 60 * 60 },
  enquiryPerVisitor: { bucket: 'enquiry', limit: 5, windowSeconds: 60 * 60 },
  enquiryEveryone: { bucket: 'enquiry-all', limit: 60, windowSeconds: 24 * 60 * 60 },
} as const;
type Rule = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

export function visitorKey(request: Request) {
  // Vercel sets x-forwarded-for / x-real-ip to the connecting client's address.
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown';
  const secret = process.env.AUTH_SECRET || process.env.STUDIO_PASSWORD || 'bramble-petal-rate-limit';
  return createHmac('sha256', secret).update(`visitor:${address}`).digest('hex');
}

async function check(rule: Rule, key: string, record: boolean) {
  const db = createStudioDatabaseClient();
  if (!db) return true;
  try {
    const { data, error } = await db.rpc('studio_rate_limit', {
      p_bucket: rule.bucket,
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_record: record,
    });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.error('[rate-limit] Limiter unavailable; allowing request.', { bucket: rule.bucket, code: (error as { code?: string })?.code });
    return true;
  }
}

/** True while this visitor (and the site as a whole) may still try to sign in. */
export async function loginAllowed(request: Request) {
  const [visitor, everyone] = await Promise.all([
    check(RATE_LIMITS.loginPerVisitor, visitorKey(request), false),
    check(RATE_LIMITS.loginEveryone, 'all', false),
  ]);
  return visitor && everyone;
}

/** Count a failed sign-in against the visitor and the site-wide allowance. */
export async function recordLoginFailure(request: Request) {
  await Promise.all([
    check(RATE_LIMITS.loginPerVisitor, visitorKey(request), true),
    check(RATE_LIMITS.loginEveryone, 'all', true),
  ]);
}

/** Checks and records one website enquiry. False means the visitor should wait. */
export async function enquiryAllowed(request: Request) {
  const visitor = await check(RATE_LIMITS.enquiryPerVisitor, visitorKey(request), true);
  if (!visitor) return false;
  return check(RATE_LIMITS.enquiryEveryone, 'all', true);
}
