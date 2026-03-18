/**
 * ValueTreeService (domain read adapter) — fetches value drivers from the DB
 * and maps them to a ValueTree via the domain adapter.
 *
 * Distinct from `services/ValueTreeService` which owns write operations
 * (optimistic locking, atomic RPC updates, realtime broadcast).
 * This service is used by the customer portal API for read-only access.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { fromValueDrivers } from '../../domain/value/adapters/valueTree.adapter';
import { getValueCase, listValueDriversForCase } from '../../domain/value/db/rows';

export class ValueTreeService {
  constructor(private supabase: SupabaseClient) {}

  async getByValueCase(tenant_id: string, value_case_id: string) {
    const valueCase = await getValueCase(this.supabase, tenant_id, value_case_id);
    if (!valueCase) throw new Error('Value case not found');
    const drivers = await listValueDriversForCase(this.supabase, tenant_id, value_case_id);
    return fromValueDrivers(value_case_id, drivers);
  }

  // Optionally, listDrivers (internal)
  async listDrivers(tenant_id: string, value_case_id: string) {
    return listValueDriversForCase(this.supabase, tenant_id, value_case_id);
  }
}
