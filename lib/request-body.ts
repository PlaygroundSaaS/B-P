export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Next may construct a localhost URL behind a proxy; Host is the incoming site.
  const expected = `${url.protocol}//${request.headers.get('host') || url.host}`;
  if ((origin && origin !== expected) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new RequestError('Please submit this request from the website.', 403);
  }
}

export async function readJsonObject(request: Request, maximum = 32_768): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new RequestError('Send a JSON request.', 415);
  if (Number(request.headers.get('content-length')) > maximum) throw new RequestError('This request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Please complete the form.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) { await reader.cancel(); throw new RequestError('This request is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RequestError('Please send valid form details.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('Please complete the form.');
  return body as Record<string, unknown>;
}
