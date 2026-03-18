/**
 * Token Re-Encryption Job
 *
 * After a key rotation (incrementing CRM_TOKEN_KEY_VERSION), existing rows in
 * crm_connections still hold ciphertext encrypted under the previous key version.
 * This job re-encrypts those rows under the current key version.
 *
 * Safety properties:
 * - Reads with the old key version, writes with the current version atomically
 *   per row (UPDATE with WHERE token_key_version = old_version guard).
 * - Processes rows in batches to limit memory and lock contention.
 * - Skips rows where decryption fails (logs error, continues).
 * - Idempotent: rows already at the current key version are filtered out by
 *   the DB query and never touched.
 * - Never logs plaintext tokens.
 *
 * Trigger: call run() after rotating CRM_TOKEN_KEY_VERSION in the environment.
 * Can be wired to a cron job, a one-off admin endpoint, or run manually.
 *
 * Usage:
 *   import { TokenReEncryptionJob } from './TokenReEncryptionJob.js';
 *   const job = new TokenReEncryptionJob();
 *   const result = await job.run();
 */

import { createLogger } from '@shared/lib/logger';

import { createServerSupabaseClient } from '../../lib/supabase.js';

import { decryptToken, encryptToken, needsReEncryption } from './tokenEncryption.js';

const logger = createLogger({ service: 'TokenReEncryptionJob' });

const BATCH_SIZE = 50;

export interface ReEncryptionResult {
  processed: number;
  reEncrypted: number;
  skipped: number;
  errors: number;
}

interface CrmConnectionRow {
  id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_key_version: number;
}

export class TokenReEncryptionJob {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    // Re-encryption requires service_role to bypass RLS — this is one of the
    // three approved service_role use cases (key rotation infrastructure).
    this.supabase = createServerSupabaseClient();
  }

  /**
   * Re-encrypt all crm_connections rows whose token_key_version is behind
   * the current CRM_TOKEN_KEY_VERSION environment variable.
   */
  async run(): Promise<ReEncryptionResult> {
    const result: ReEncryptionResult = { processed: 0, reEncrypted: 0, skipped: 0, errors: 0 };

    logger.info('TokenReEncryptionJob: starting');

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: rows, error } = await this.supabase
        .from('crm_connections')
        .select('id, access_token_enc, refresh_token_enc, token_key_version')
        // Fetch rows where either token column is non-null so that rows with
        // only a refresh_token are not skipped after a key rotation.
        .or('access_token_enc.not.is.null,refresh_token_enc.not.is.null')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('id');

      if (error) {
        logger.error('TokenReEncryptionJob: failed to fetch batch', { offset, error: error.message });
        break;
      }

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows as CrmConnectionRow[]) {
        result.processed++;

        // Skip rows that don't need re-encryption
        const accessNeedsRotation = row.access_token_enc
          ? needsReEncryption(row.access_token_enc)
          : false;
        const refreshNeedsRotation = row.refresh_token_enc
          ? needsReEncryption(row.refresh_token_enc)
          : false;

        if (!accessNeedsRotation && !refreshNeedsRotation) {
          result.skipped++;
          continue;
        }

        try {
          await this.reEncryptRow(row);
          result.reEncrypted++;
        } catch (err) {
          result.errors++;
          logger.error('TokenReEncryptionJob: failed to re-encrypt row', {
            id: row.id,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue — do not abort the entire job for one bad row
        }
      }

      hasMore = rows.length === BATCH_SIZE;
      offset += BATCH_SIZE;
    }

    logger.info('TokenReEncryptionJob: complete', result);
    return result;
  }

  private async reEncryptRow(row: CrmConnectionRow): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (row.access_token_enc && needsReEncryption(row.access_token_enc)) {
      const plaintext = decryptToken(row.access_token_enc);
      updates['access_token_enc'] = encryptToken(plaintext);
    }

    if (row.refresh_token_enc && needsReEncryption(row.refresh_token_enc)) {
      const plaintext = decryptToken(row.refresh_token_enc);
      updates['refresh_token_enc'] = encryptToken(plaintext);
    }

    // Record the new key version
    const currentVersion = this.getCurrentKeyVersion();
    updates['token_key_version'] = currentVersion;

    // Conditional update: only apply if the row hasn't been updated by a
    // concurrent job run (optimistic concurrency via token_key_version guard).
    const { error } = await this.supabase
      .from('crm_connections')
      .update(updates)
      .eq('id', row.id)
      .eq('token_key_version', row.token_key_version);

    if (error) {
      throw new Error(`DB update failed for row ${row.id}: ${error.message}`);
    }
  }

  private getCurrentKeyVersion(): number {
    const v = process.env['CRM_TOKEN_KEY_VERSION'];
    return v ? parseInt(v, 10) : 1;
  }
}

export const tokenReEncryptionJob = new TokenReEncryptionJob();
