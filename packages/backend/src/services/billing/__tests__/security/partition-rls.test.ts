import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('partition maintenance RLS safeguards', () => {
  it('ensures create_next_monthly_partitions enables RLS on new partitions', async () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'infra/supabase/supabase/migrations/20260925000000_billing_credits_ledger_and_partition_rls.sql'
    );
    const migration = await fs.readFile(migrationPath, 'utf8');

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_next_monthly_partitions()");
    expect(migration).toContain("ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("p.relname IN ('usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events')");
  });
});
