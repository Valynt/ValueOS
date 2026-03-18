import type { SupabaseClient } from '@supabase/supabase-js';

import { fromFinancialModel } from '../../domain/value/adapters/roiModel.adapter';
import { RoiModelSchema } from '../../domain/value/schemas/roiModel.schema';
import { getFinancialModelForCase } from '../../domain/value/db/rows';
import type { RoiModel } from '../../domain/value/dto';

export class RoiModelService {
  constructor(private supabase: SupabaseClient) {}

  async getByValueCase(tenant_id: string, value_case_id: string) {
    const modelRow = await getFinancialModelForCase(this.supabase, tenant_id, value_case_id);
    if (!modelRow) throw new Error('Financial model not found');
    return fromFinancialModel(value_case_id, modelRow);
  }

  async update(
    tenant_id: string,
    value_case_id: string,
    updates: Pick<RoiModel, 'assumptions' | 'outputs'>,
  ): Promise<RoiModel> {
    // Validate the full model shape before persisting
    const validated = RoiModelSchema.parse({
      valueCaseId: value_case_id,
      ...updates,
    });

    const row = {
      tenant_id,
      value_case_id,
      assumptions: validated.assumptions,
      outputs: validated.outputs,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (this.supabase
      .from('financial_models') as ReturnType<typeof this.supabase.from>)
      .upsert(row as never, { onConflict: 'tenant_id,value_case_id' })
      .eq('tenant_id', tenant_id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update financial model: ${error.message}`);
    }

    return fromFinancialModel(value_case_id, data as Record<string, unknown>);
  }
}
