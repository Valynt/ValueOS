import type { SupabaseClient } from '@supabase/supabase-js';

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Polls a Supabase table until a row matching all filter key-value pairs is
 * found, or the timeout elapses.
 *
 * Single-shot queries are not permitted in E2E DB assertions because async
 * persistence latency makes them flaky. Use this function for all DB
 * assertions in wf-N specs.
 *
 * @throws When no matching row is found within timeoutMs. The error message
 *   includes the table name, filter, and elapsed time for diagnostics.
 */
export async function pollForRow(
  supabase: SupabaseClient,
  table: string,
  filter: Record<string, string>,
  options?: PollOptions,
): Promise<Record<string, unknown>> {
  const intervalMs = options?.intervalMs ?? 500;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const startedAt = Date.now();

  while (true) {
    let query = supabase.from(table).select('*');
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(
        `pollForRow: query error on table "${table}" with filter ${JSON.stringify(filter)}: ${error.message}`,
      );
    }

    if (data !== null && data !== undefined) {
      return data as Record<string, unknown>;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw new Error(
        `pollForRow: no row found in table "${table}" with filter ${JSON.stringify(filter)} after ${elapsed}ms`,
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}
