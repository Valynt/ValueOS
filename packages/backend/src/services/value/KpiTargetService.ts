import { createClient } from '@supabase/supabase-js';
import { getFinancialModelForCase, listValueDriversForCase } from '../../../domain/value/db/rows';
import { deriveKpis } from '../../../domain/value/adapters/kpiTarget.derived';

export class KpiTargetService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async deriveForValueCase(tenant_id: string, value_case_id: string) {
    const model = await getFinancialModelForCase(this.supabase, tenant_id, value_case_id);
    if (!model) throw new Error('Financial model not found');
    const drivers = await listValueDriversForCase(this.supabase, tenant_id, value_case_id);
    return deriveKpis(model, { nodes: drivers });
  }
}
