import { type SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'UsageLedgerIngestionService' });

export interface UsageLedgerEvent {
  tenantId: string;
  agentId: string;
  valueUnits: number;
  evidenceLink: string;
  requestId: string;
}

export interface UsageLedgerIngestionResult {
  inserted: boolean;
  duplicate: boolean;
}

export class UsageLedgerIngestionService {
  constructor(private readonly supabase: SupabaseClient) {}

  async ingest(event: UsageLedgerEvent): Promise<UsageLedgerIngestionResult> {
    const payload = {
      tenant_id: event.tenantId,
      agent_id: event.agentId,
      value_units: event.valueUnits,
      evidence_link: event.evidenceLink,
      request_id: event.requestId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('usage_ledger')
      .insert(payload, {
        onConflict: 'tenant_id,request_id',
        ignoreDuplicates: true,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to ingest usage ledger event', error, {
        tenantId: event.tenantId,
        requestId: event.requestId,
        agentId: event.agentId,
      });
      throw error;
    }

    const inserted = Boolean(data?.id);

    logger.debug('Usage ledger ingestion processed', {
      tenantId: event.tenantId,
      requestId: event.requestId,
      inserted,
      duplicate: !inserted,
    });

    return {
      inserted,
      duplicate: !inserted,
    };
  }
}
