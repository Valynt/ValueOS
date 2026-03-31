/**
 * TokenReEncryptionJob tests
 *
 * Verifies batch re-encryption logic, idempotency, error isolation,
 * and optimistic concurrency guard — all without a live DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No static vi.mock for supabase — each test uses vi.doMock after vi.resetModules()
// so the correct mock is in place when the module is dynamically imported.

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEnv(keyVersion = 1) {
  return {
    CRM_TOKEN_ENCRYPTION_KEY: 'test-key-for-unit-tests-exactly-32ch!',
    CRM_TOKEN_ENCRYPTION_KEY_V2: 'test-key-v2-for-unit-tests-32chars!',
    CRM_TOKEN_KEK_SECRET: 'test-kek-secret-v1',
    CRM_TOKEN_KEK_SECRET_V2: 'test-kek-secret-v2',
    CRM_TOKEN_KEY_VERSION: String(keyVersion),
  };
}

/**
 * Build a minimal Supabase mock.
 *
 * The update chain is resolved lazily: .update(payload) returns a chainable
 * object whose .eq() calls accumulate filters. The promise only resolves when
 * the chain is awaited, by which point all chained .eq() calls have run.
 * This correctly models Supabase's fluent API and allows the optimistic
 * concurrency guard (.eq('token_key_version', old)) to be tested.
 */
function makeSupabaseMock(rows: Record<string, unknown>[]) {
  const updates: Array<{ id: unknown; payload: Record<string, unknown>; filters: Array<{ col: string; val: unknown }> }> = [];

  function buildSelectChain(currentRows: Record<string, unknown>[]) {
    const selectFilters: Array<{ col: string; val: unknown; op: string }> = [];
    let rangeStart = 0;
    let rangeEnd = Infinity;
    let orFilter: string | null = null;

    const applyFilters = (r: Record<string, unknown>[]) => {
      let result = r;
      if (orFilter) {
        const parts = orFilter.split(',');
        result = result.filter(row =>
          parts.some(part => {
            if (part.endsWith('.not.is.null')) {
              const col = part.replace('.not.is.null', '');
              return row[col] != null;
            }
            return true;
          })
        );
      }
      result = result.filter(row =>
        selectFilters.every(f => {
          if (f.op === 'eq') return row[f.col] === f.val;
          return true;
        })
      );
      return result.slice(rangeStart, rangeEnd + 1);
    };

    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      not:    vi.fn().mockReturnThis(),
      or:     vi.fn((expr: string) => { orFilter = expr; return chain; }),
      range:  vi.fn((s: number, e: number) => { rangeStart = s; rangeEnd = e; return chain; }),
      order:  vi.fn().mockReturnThis(),
      eq:     vi.fn((col: string, val: unknown) => { selectFilters.push({ col, val, op: 'eq' }); return chain; }),

      // update() returns a NEW chain that collects its own eq() filters lazily.
      // The promise resolves on the next microtask so all synchronous chained
      // .eq() calls have time to register before the filters are applied.
      update: vi.fn((payload: Record<string, unknown>) => {
        const updateFilters: Array<{ col: string; val: unknown }> = [];
        let resolveUpdate!: (v: unknown) => void;
        const deferred = new Promise(res => { resolveUpdate = res; });

        const updateChain: Record<string, unknown> = {
          eq: vi.fn((col: string, val: unknown) => {
            updateFilters.push({ col, val });
            return updateChain;
          }),
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
            Promise.resolve().then(() => {
              const matched = applyFilters(currentRows).filter(row =>
                updateFilters.every(f => row[f.col] === f.val)
              );
              matched.forEach(row => {
                Object.assign(row, payload);
                updates.push({ id: row['id'], payload, filters: [...updateFilters] });
              });
              resolveUpdate({ data: matched, error: null });
            });
            return deferred.then(onFulfilled, onRejected);
          },
          catch: (onRejected: (e: unknown) => unknown) => deferred.catch(onRejected),
        };

        return updateChain;
      }),
    };

    // Make select chain thenable
    const selectPromise = {
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: applyFilters(currentRows), error: null })
          .then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve({ data: applyFilters(currentRows), error: null }).catch(onRejected),
    };
    Object.assign(chain, selectPromise);

    return chain;
  }

  const supabase = {
    from: vi.fn(() => buildSelectChain(rows)),
    _updates: updates,
    _rows: rows,
  };

  return supabase;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TokenReEncryptionJob', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(1) };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('skips rows already at the current key version', async () => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(1) };
    vi.resetModules();

    const { encryptToken } = await import('../tokenEncryption.js');
    const token = encryptToken('access-token-v1');

    const rows = [{ id: 'row-1', access_token_enc: token, refresh_token_enc: null, token_key_version: 1 }];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const result = await new TokenReEncryptionJob().run();

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.reEncrypted).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('re-encrypts rows whose token was encrypted with an old key version and stores new ciphertext', async () => {
    // Encrypt with v1
    process.env = { ...ORIGINAL_ENV, ...makeEnv(1) };
    vi.resetModules();
    const { encryptToken: encryptV1 } = await import('../tokenEncryption.js');
    const v1Token = encryptV1('access-token-plaintext');

    // Switch to v2 for the job run
    process.env = { ...ORIGINAL_ENV, ...makeEnv(2) };
    vi.resetModules();

    const rows = [{
      id: 'row-1',
      access_token_enc: v1Token,
      refresh_token_enc: null,
      token_key_version: 1,
    }];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const result = await new TokenReEncryptionJob().run();

    expect(result.reEncrypted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);

    // Verify the stored ciphertext was actually replaced with a new value
    expect(supabase._updates).toHaveLength(1);
    const updatedToken = supabase._updates[0].payload['access_token_enc'] as string;
    expect(updatedToken).toBeTruthy();
    expect(updatedToken).not.toBe(v1Token);

    // Verify the new ciphertext decrypts to the original plaintext under v2
    const { decryptToken } = await import('../tokenEncryption.js');
    expect(decryptToken(updatedToken)).toBe('access-token-plaintext');
  });

  it('enforces optimistic concurrency guard — only updates rows at the expected key version', async () => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(2) };
    vi.resetModules();

    const { encryptToken } = await import('../tokenEncryption.js');
    // Row already at current version — simulates a concurrent run having updated it
    const v2Token = encryptToken('my-token');

    const rows = [{
      id: 'row-1',
      access_token_enc: v2Token,
      refresh_token_enc: null,
      token_key_version: 2, // already at current version
    }];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const result = await new TokenReEncryptionJob().run();

    // Row is at current version — should be skipped, not re-encrypted
    expect(result.skipped).toBe(1);
    expect(result.reEncrypted).toBe(0);
    expect(supabase._updates).toHaveLength(0);
  });

  it('re-encrypts rows where only refresh_token_enc is non-null', async () => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(1) };
    vi.resetModules();
    const { encryptToken: encryptV1 } = await import('../tokenEncryption.js');
    const v1Refresh = encryptV1('refresh-token-plaintext');

    process.env = { ...ORIGINAL_ENV, ...makeEnv(2) };
    vi.resetModules();

    const rows = [{
      id: 'row-1',
      access_token_enc: null,
      refresh_token_enc: v1Refresh,
      token_key_version: 1,
    }];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const result = await new TokenReEncryptionJob().run();

    expect(result.reEncrypted).toBe(1);
    expect(supabase._updates).toHaveLength(1);
    const updatedRefresh = supabase._updates[0].payload['refresh_token_enc'] as string;
    expect(updatedRefresh).not.toBe(v1Refresh);
    const { decryptToken } = await import('../tokenEncryption.js');
    expect(decryptToken(updatedRefresh)).toBe('refresh-token-plaintext');
  });

  it('isolates errors per row and continues processing', async () => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(2) };
    vi.resetModules();

    const rows = [
      { id: 'bad-row',  access_token_enc: 'v1:corrupted:data:here', refresh_token_enc: null, token_key_version: 1 },
      { id: 'good-row', access_token_enc: null, refresh_token_enc: null, token_key_version: 1 },
    ];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const result = await new TokenReEncryptionJob().run();

    expect(result.errors).toBe(1);
    expect(result.processed).toBe(2);
  });

  it('is idempotent — running twice does not double-process', async () => {
    process.env = { ...ORIGINAL_ENV, ...makeEnv(1) };
    vi.resetModules();

    const { encryptToken } = await import('../tokenEncryption.js');
    const token = encryptToken('my-token');

    const rows = [{ id: 'row-1', access_token_enc: token, refresh_token_enc: null, token_key_version: 1 }];
    const supabase = makeSupabaseMock(rows);

    vi.doMock('../../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
    const { TokenReEncryptionJob } = await import('../TokenReEncryptionJob.js');

    const job = new TokenReEncryptionJob();
    const r1 = await job.run();
    const r2 = await job.run();

    expect(r1.skipped).toBe(1);
    expect(r2.skipped).toBe(1);
    expect(r1.reEncrypted).toBe(0);
    expect(r2.reEncrypted).toBe(0);
  });
});
