import { createClient } from '@supabase/supabase-js';
import { getValueCommitmentsForCase } from '../../../domain/value/db/rows';
import { fromValueCommitments } from '../../../domain/value/adapters/valueCommit.adapter';

export class ValueCommitService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async get(tenant_id: string, value_case_id: string) {
    const commitments = await getValueCommitmentsForCase(this.supabase, tenant_id, value_case_id);
    return fromValueCommitments(commitments);
  }

  // transition(tenant_id, value_case_id, event) would go here
}
