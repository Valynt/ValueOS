import { createClient } from '@supabase/supabase-js';
import { getValueCase, listValueDriversForCase } from '../../../domain/value/db/rows';
import { fromValueDrivers } from '../../../domain/value/adapters/valueTree.adapter';

export class ValueTreeService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

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
