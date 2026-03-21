/**
 * BaseGraphWriter
 *
 * Shared composition class for agents that write to the Value Graph.
 * Encapsulates three patterns established in Sprint 48:
 *
 *   1. opportunity_id resolution — canonical key is value_case_id in
 *      user_inputs; falls back to workspace_id.
 *   2. UUID generation — always randomUUID(), never a human-readable slug.
 *   3. Fire-and-forget error handling — graph write failures are logged
 *      with context and never propagated to the agent's primary output.
 *
 * Agents compose this class (not extend — agents already extend BaseAgent).
 *
 * Sprint 49: Initial implementation.
 */

import { randomUUID } from "crypto";

import type { LifecycleContext } from "../../types/agent.js";
import { logger as defaultLogger } from "../../lib/logger.js";
import type { ValueGraphService } from "./ValueGraphService.js";

type Logger = typeof defaultLogger;

export class BaseGraphWriter {
  constructor(
    protected readonly valueGraphService: ValueGraphService,
    protected readonly logger: Logger,
  ) {}

  /**
   * Resolves opportunity_id from context using the canonical value_case_id key.
   * Falls back to workspace_id. Returns undefined when both are absent.
   */
  protected resolveOpportunityId(context: LifecycleContext): string | undefined {
    return (context.user_inputs?.value_case_id as string | undefined)
      ?? context.workspace_id
      ?? undefined;
  }

  /** Returns a fresh UUID for use as an entity ID on graph nodes/edges. */
  protected newEntityId(): string {
    return randomUUID();
  }

  /**
   * Wraps a graph write operation in fire-and-forget error handling.
   * Failures are logged with context; never propagated to the caller.
   */
  protected async safeWrite<T>(
    operation: () => Promise<T>,
    context: { opportunityId: string; organizationId: string; agentName: string },
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (err) {
      this.logger.warn(`${context.agentName}: graph write failed`, {
        opportunityId: context.opportunityId,
        organizationId: context.organizationId,
        error: (err as Error).message,
      });
      return undefined;
    }
  }
}
