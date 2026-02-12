import { createClient } from '@supabase/supabase-js';
import { getFinancialModelForCase } from '../../domain/value/db/rows';
import { fromFinancialModel } from '../../domain/value/adapters/roiModel.adapter';

export class RoiModelService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async getByValueCase(tenant_id: string, value_case_id: string) {
    const modelRow = await getFinancialModelForCase(this.supabase, tenant_id, value_case_id);
    if (!modelRow) throw new Error('Financial model not found');
    return fromFinancialModel(value_case_id, modelRow);
  }

  // Optionally, update method (not implemented here)
}
