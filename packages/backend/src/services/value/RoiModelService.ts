import type { SupabaseClient } from '@supabase/supabase-js';

import { fromFinancialModel } from '../../domain/value/adapters/roiModel.adapter';
import { RoiModelSchema } from '../../domain/value/schemas/roiModel.schema';
import { getFinancialModelForCase } from '../../domain/value/db/rows';
import type { RoiModel } from '../../domain/value/dto';

// ---------------------------------------------------------------------------
// CACHING DECISION — Phase 4a.3b (implementation deferred, boundaries defined)
//
// getByValueCase() is a candidate for read-through caching. The financial model
// for a given case is expensive to assemble (DB read + adapter transform) and
// is read far more often than it is written.
//
// Proposed cache key:
//   roi-model:{tenant_id}:{value_case_id}
//   tenant_id MUST be part of the key — tenant isolation is non-negotiable.
//
// Proposed TTL: 5 minutes (300 seconds).
//   Rationale: models are updated infrequently; a short TTL limits stale-read
//   exposure without requiring explicit invalidation on every read path.
//
// Invalidation trigger:
//   update() must call cache.delete(`roi-model:${tenant_id}:${value_case_id}`)
//   after a successful upsert. Any other write path that modifies financial_models
//   must do the same.
//
// Correctness risk:
//   If a user edits assumptions and immediately reads the model, they could see
//   stale outputs for up to TTL seconds. Mitigate by invalidating on write (above)
//   rather than relying on TTL expiry alone.
//
// Implementation: use CacheService from packages/backend/src/services/CacheService.ts.
// Do not implement until Phase 4a.3b is reviewed and approved.
// ---------------------------------------------------------------------------

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
