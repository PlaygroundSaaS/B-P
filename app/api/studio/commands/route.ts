import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient } from '@/lib/studio-database';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { applyStudioCommand } from '@/lib/studio-commands';
import { commandHash, commitWorkspace, priorCommand, readWorkspace } from '@/lib/studio-command-server';
import type { StudioCommand } from '@/lib/operations-types';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  if (!await hasStudioSession()) return json({ error: 'Please sign in to save changes.' }, 401);
  try {
    requireSameOrigin(request);
    const body = await readJsonObject(request, 4 * 1024 * 1024);
    if (typeof body.operationId !== 'string' || !body.command || typeof body.command !== 'object' || typeof body.expectedUpdatedAt !== 'string') throw new RequestError('The action is incomplete. Refresh and try again.');
    const db = createStudioDatabaseClient(); if (!db) throw new RequestError('The Studio is temporarily unavailable.', 503);
    const hash = commandHash(body.command);
    if (await priorCommand(db, body.operationId, hash)) return json({ ...await readWorkspace(db), alreadyApplied: true });
    const current = await readWorkspace(db);
    if (current.updatedAt !== body.expectedUpdatedAt) throw new RequestError('The Studio changed. Load the latest records before saving.', 409);
    let result;
    try { result = applyStudioCommand(current.data, body.command as StudioCommand); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'Check the action details.'); }
    return json(await commitWorkspace(db, { id: body.operationId, hash, revision: current.updatedAt, ...result }));
  } catch (error) { return json({ error: error instanceof RequestError ? error.message : 'The change could not be confirmed. Refresh and try again.' }, error instanceof RequestError ? error.status : 503); }
}
