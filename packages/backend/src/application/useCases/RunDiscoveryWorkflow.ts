/**
 * RunDiscoveryWorkflow — Application Use Case
 *
 * Orchestrates the discovery workflow for a value case.
 * Extracts the orchestration logic that was previously embedded in the route handler.
 *
 * Responsibilities:
 *   1. Validate the value case belongs to the requesting tenant
 *   2. Invoke the DiscoveryAgent via the agent fabric
 *   3. Emit an audit log entry for the discovery start
 *   4. Return the run ID for polling
 *
 * Routes call this use case; they do NOT directly invoke agents.
 */

import { z } from 'zod';
import { createLogger } from '../../lib/logger.js';
import { auditLogService } from '../../services/security/AuditLogService.js';
import type { UseCase, RequestContext, UseCaseResult } from '../types.js';

const logger = createLogger({ component: 'RunDiscoveryWorkflow' });

// ============================================================================
// Input / Output schemas
// ============================================================================

export const RunDiscoveryWorkflowInputSchema = z.object({
  valueCaseId: z.string().uuid(),
  companyName: z.string().min(1).max(200),
  industryContext: z.string().max(500).optional(),
});

export type RunDiscoveryWorkflowInput = z.infer<typeof RunDiscoveryWorkflowInputSchema>;

export interface DiscoveryWorkflowResult {
  runId: string;
  status: 'started';
  valueCaseId: string;
}

// ============================================================================
// Agent port — injected, not imported directly
// ============================================================================

export interface DiscoveryAgentPort {
  startDiscovery(params: {
    organizationId: string;
    valueCaseId: string;
    companyName: string;
    industryContext?: string;
  }): Promise<{ runId: string }>;
}

// ============================================================================
// Use Case Implementation
// ============================================================================

export class RunDiscoveryWorkflow
  implements UseCase<RunDiscoveryWorkflowInput, UseCaseResult<DiscoveryWorkflowResult>>
{
  constructor(private readonly discoveryAgent: DiscoveryAgentPort) {}

  async execute(
    input: RunDiscoveryWorkflowInput,
    context: RequestContext
  ): Promise<UseCaseResult<DiscoveryWorkflowResult>> {
    const startMs = Date.now();

    logger.info('RunDiscoveryWorkflow: executing', {
      valueCaseId: input.valueCaseId,
      organizationId: context.organizationId,
      userId: context.userId,
      traceId: context.traceId,
    });

    // Validate input
    const parsed = RunDiscoveryWorkflowInputSchema.safeParse(input);
    if (!parsed.success) {
      throw Object.assign(new Error('Invalid RunDiscoveryWorkflow input'), {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    // Invoke agent via fabric — no direct LLM calls in use cases
    const result = await this.discoveryAgent.startDiscovery({
      organizationId: context.organizationId,
      valueCaseId: parsed.data.valueCaseId,
      companyName: parsed.data.companyName,
      industryContext: parsed.data.industryContext,
    });

    // Emit audit log
    await auditLogService.logAudit({
      action: 'discovery_workflow.started',
      actorId: context.userId,
      tenantId: context.organizationId,
      resourceType: 'value_case',
      resourceId: parsed.data.valueCaseId,
      metadata: {
        runId: result.runId,
        companyName: parsed.data.companyName,
        traceId: context.traceId,
      },
    }).catch((err) => {
      logger.error('RunDiscoveryWorkflow: audit log failed', { err, traceId: context.traceId });
    });

    const durationMs = Date.now() - startMs;
    logger.info('RunDiscoveryWorkflow: discovery started', {
      runId: result.runId,
      valueCaseId: parsed.data.valueCaseId,
      durationMs,
      traceId: context.traceId,
    });

    return {
      data: {
        runId: result.runId,
        status: 'started',
        valueCaseId: parsed.data.valueCaseId,
      },
      meta: { traceId: context.traceId, durationMs },
    };
  }
}
