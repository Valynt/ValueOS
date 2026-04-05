import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseRuntimePorts } from '../adapters/SupabaseRuntimePorts.js';
import type {
  BusinessCaseRoutingSnapshot,
  DecisionContextReadPort,
  DecisionContextSnapshot,
  HypothesisRoutingSnapshot,
  OpportunityRoutingSnapshot,
} from '../ports/runtimePorts.js';

export type {
  BusinessCaseRoutingSnapshot,
  DecisionContextSnapshot,
  HypothesisRoutingSnapshot,
  OpportunityRoutingSnapshot,
};

/**
 * Backward-compatible alias kept while runtime modules migrate to the
 * shared runtime port contracts under runtime/ports.
 */
export type DecisionContextRepository = DecisionContextReadPort;

export class SupabaseDecisionContextRepository implements DecisionContextRepository {
  private readonly adapter: DecisionContextReadPort;

  constructor(supabase: SupabaseClient) {
    this.adapter = createSupabaseRuntimePorts(supabase).decisionContext;
  }

  getSnapshot(opportunityId: string, organizationId: string): Promise<DecisionContextSnapshot> {
    return this.adapter.getSnapshot(opportunityId, organizationId);
  }
}
