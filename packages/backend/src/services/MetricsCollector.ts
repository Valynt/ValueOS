/**
 * MetricsCollector shim.
 *
 * Re-exports the canonical billing MetricsCollector so that callers in
 * src/services/ and src/api/ can import from a stable path without knowing
 * the billing subdirectory layout.
 *
 * Also adds the agent/LLM-specific helpers that agents.ts calls
 * (recordAgentInvocation, recordLLMCall) as thin wrappers over recordUsage.
 */

import { supabase } from '../lib/supabase.js';
import {
  getMetricsCollector as getBillingMetricsCollector,
  MetricsCollector as BillingMetricsCollector,
} from './billing/MetricsCollector.js';

export { MetricsCollector } from './billing/MetricsCollector.js';

// ---------------------------------------------------------------------------
// Extended collector — adds agent/LLM helpers used by agents.ts
// ---------------------------------------------------------------------------

class AgentMetricsCollector extends BillingMetricsCollector {
  /**
   * Record a completed agent invocation.
   * Emits an `agent_executions` usage event for the tenant when tenantId is
   * available on the context. Falls back to a no-op when tenantId is absent
   * (e.g. cache-hit path where tenant context may not be set).
   */
  recordAgentInvocation(
    agentId: string,
    succeeded: boolean,
    durationMs: number,
    tenantId?: string,
  ): void {
    if (tenantId) {
      this.recordUsage({
        tenantId,
        metric: 'agent_executions',
        quantity: 1,
        path: `/api/agents/${agentId}/invoke`,
        statusCode: succeeded ? 200 : 500,
      });
    }
  }

  /**
   * Record an LLM call. Emits an `llm_tokens` usage event when tokenCount > 0.
   */
  recordLLMCall(
    model: string,
    agentId: string,
    inputTokens: number,
    outputTokens: number,
    cached: boolean,
    tenantId?: string,
  ): void {
    const totalTokens = inputTokens + outputTokens;
    if (tenantId && totalTokens > 0 && !cached) {
      this.recordUsage({
        tenantId,
        metric: 'llm_tokens',
        quantity: totalTokens,
        path: `/api/agents/${agentId}/invoke`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: AgentMetricsCollector | null = null;

export function getMetricsCollector(): AgentMetricsCollector {
  if (!_instance) {
    _instance = new AgentMetricsCollector(supabase ?? undefined);
  }
  return _instance;
}

export function resetMetricsCollector(): void {
  _instance = null;
}
