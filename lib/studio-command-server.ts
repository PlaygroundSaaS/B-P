import { createHash } from 'node:crypto';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from './studio-database';
import { reviveData } from './studio-data';
import { isStudioData } from './studio-validation';
import { RequestError } from './request-body';
import type { InventoryTransaction } from './operations-types';
import type { StudioData } from './types';
export type StudioDatabase = NonNullable<ReturnType<typeof createStudioDatabaseClient>>;
export const commandHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readWorkspace(db: StudioDatabase) {
  const { data, error } = await db.from('studio_app_state').select('data,updated_at').eq('workspace_key', STUDIO_WORKSPACE).single();
  if (error || !data) throw new RequestError('The Studio could not be loaded. Please try again.', 503);
  return { data: reviveData(data.data), updatedAt: data.updated_at as string };
}
export async function priorCommand(db: StudioDatabase, id: string, hash: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new RequestError('Refresh the page before saving this action.');
  const { data, error } = await db.from('studio_command_receipts').select('payload_hash').eq('workspace_key', STUDIO_WORKSPACE).eq('operation_id', id).maybeSingle();
  if (error) throw new RequestError('The transaction service is unavailable. Nothing has changed.', 503);
  if (data && data.payload_hash !== hash) throw new RequestError('This action reference was already used. Refresh and retry.', 409);
  return !!data;
}
export async function commitWorkspace(db: StudioDatabase, args: { id: string; hash: string; revision: string; data: StudioData; action: string; recordIds: string[]; transactions?: InventoryTransaction[] | null; actor?: string }) {
  if (!isStudioData(args.data)) throw new RequestError('Some records contain invalid values. Check your entries; nothing was saved.');
  const { data, error } = await db.rpc('studio_commit_command', { p_workspace: STUDIO_WORKSPACE, p_operation_id: args.id, p_payload_hash: args.hash, p_expected_updated_at: args.revision, p_data: args.data, p_action: args.action, p_record_ids: args.recordIds, p_transactions: args.transactions ?? null, p_actor: args.actor || process.env.STUDIO_USERNAME || 'jade' });
  if (error) throw new RequestError(error.code === '40001' ? 'Another change was saved first. Load the latest records and try again.' : 'This change could not be confirmed. Refresh before retrying; the action will not be applied twice.', error.code === '40001' ? 409 : 503);
  return data;
}
