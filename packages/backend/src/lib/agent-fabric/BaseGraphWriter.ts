/**
 * BaseGraphWriter
 *
 * Composable utility for agents that write nodes and edges to the Value Graph.
 * Enforces three invariants that prevented silent failures in Sprint 48:
 *
 *   1. Canonical context extraction — opportunity_id and organization_id are
 *      strictly validated as UUIDs; no silent fallback to workspace_id.
 *
 *   2. Safe UUID generation — generateNodeId() always returns a valid UUID v4;
 *      raw string fallbacks never reach UUID Postgres columns.
 *
 *   3. Atomic write isolation — safeWriteBatch() uses Promise.allSettled so
 *      one failed write does not abort the remaining writes.
 *
 * Usage (composition pattern — agents already extend BaseAgent):
 *
 *   class NarrativeAgent extends BaseAgent {
 *     private readonly graphWriter = new BaseGraphWriter();
 *
 *     private async writeGraphNodes(context: LifecycleContext, ...) {
 *       const { opportunityId, organizationId } = this.graphWriter.getSafeContext(context);
 *       await this.graphWriter.safeWriteBatch([
 *         () => this.graphWriter.writeValueDriver(context, { ... }),
 *         () => this.graphWriter.writeEdge(context, { ... }),
 *       ]);
 *     }
 *   }
 */

import type {
  VgCapability,
  VgMetric,
  VgValueDriver,
  ValueGraphEdge,
} from "@valueos/shared";

import { logger } from "../logger.js";
import {
  type WriteCapabilityInput,
  type WriteEdgeInput,
  type WriteMetricInput,
  type WriteValueDriverInput,
  valueGraphService,
  ValueGraphService,
} from "../../services/value-graph/ValueGraphService.js";
import type { LifecycleContext } from "../../types/agent.js";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown when a LifecycleContext is missing required graph-write fields
 * (opportunity_id or organization_id) or when those fields are not valid UUIDs.
 */
export class LifecycleContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleContextError";
  }
}

// ---------------------------------------------------------------------------
// UUID validation helper
// ---------------------------------------------------------------------------

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

// ---------------------------------------------------------------------------
// SafeWriteBatch result
// ---------------------------------------------------------------------------

export interface SafeWriteResult {
  succeeded: number;
  failed: number;
  errors: Error[];
}

// ---------------------------------------------------------------------------
// BaseGraphWriter
// ---------------------------------------------------------------------------

export class BaseGraphWriter {
  private readonly service: ValueGraphService;

  constructor(service: ValueGraphService) {
    this.service = service;
  }

  // -------------------------------------------------------------------------
  // Invariant 1 — Canonical context extraction
  // -------------------------------------------------------------------------

  /**
   * Extracts and validates opportunity_id and organization_id from a
   * LifecycleContext. Throws LifecycleContextError if either field is absent
   * or not a valid UUID v4.
   *
   * Checks context.user_inputs.opportunity_id first, then
   * context.metadata?.opportunity_id, before giving up. Never falls back to
   * workspace_id or any other key.
   */
  getSafeContext(context: LifecycleContext): {
    opportunityId: string;
    organizationId: string;
  } {
    // Extract opportunity_id
    const rawOpportunityId =
      context.user_inputs?.["opportunity_id"] ??
      context.metadata?.["opportunity_id"];

    if (!isValidUuid(rawOpportunityId)) {
      throw new LifecycleContextError(
        `BaseGraphWriter: opportunity_id is missing or not a valid UUID v4. ` +
          `Received: ${JSON.stringify(rawOpportunityId)}. ` +
          `Ensure the caller sets context.user_inputs.opportunity_id before invoking graph writes.`,
      );
    }

    // Extract organization_id
    const rawOrganizationId = context.organization_id;

    if (!isValidUuid(rawOrganizationId)) {
      throw new LifecycleContextError(
        `BaseGraphWriter: organization_id is missing or not a valid UUID v4. ` +
          `Received: ${JSON.stringify(rawOrganizationId)}. ` +
          `Ensure LifecycleContext.organization_id is set to the tenant UUID.`,
      );
    }

    return {
      opportunityId: rawOpportunityId,
      organizationId: rawOrganizationId,
    };
  }

  // -------------------------------------------------------------------------
  // Invariant 2 — Safe UUID generation
  // -------------------------------------------------------------------------

  /**
   * Returns a valid UUID v4.
   *
   * If deterministicInput is already a valid UUID v4, it is returned as-is
   * (idempotent for callers that already have a stable ID).
   * Otherwise, crypto.randomUUID() is called — raw string fallbacks never
   * reach UUID Postgres columns.
   */
  generateNodeId(deterministicInput?: string): string {
    if (deterministicInput !== undefined && isValidUuid(deterministicInput)) {
      return deterministicInput;
    }
    return crypto.randomUUID();
  }

  // -------------------------------------------------------------------------
  // Invariant 3 — Atomic write isolation
  // -------------------------------------------------------------------------

  /**
   * Executes an array of write thunks using Promise.allSettled so that one
   * failed write does not abort the remaining writes.
   *
   * Each failure is logged with its index and error message. The caller
   * receives a summary and decides whether to surface partial failure in the
   * agent output.
   */
  async safeWriteBatch(
    writes: Array<() => Promise<unknown>>,
  ): Promise<SafeWriteResult> {
    const results = await Promise.allSettled(writes.map((fn) => fn()));

    const errors: Error[] = [];
    let succeeded = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        succeeded++;
      } else {
        const err =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));
        errors.push(err);
        logger.error("BaseGraphWriter: write failed", err, {
          writeIndex: i,
          totalWrites: writes.length,
        });
      }
    }

    return { succeeded, failed: errors.length, errors };
  }

  // -------------------------------------------------------------------------
  // Convenience write methods
  // -------------------------------------------------------------------------

  /**
   * Upserts a VgCapability node. Injects opportunity_id and organization_id
   * from the LifecycleContext automatically.
   */
  async writeCapability(
    context: LifecycleContext,
    input: Omit<WriteCapabilityInput, "opportunity_id" | "organization_id">,
  ): Promise<VgCapability> {
    const { opportunityId, organizationId } = this.getSafeContext(context);
    return this.service.writeCapability({
      ...input,
      opportunity_id: opportunityId,
      organization_id: organizationId,
    });
  }

  /**
   * Upserts a VgMetric node. Injects opportunity_id and organization_id
   * from the LifecycleContext automatically.
   */
  async writeMetric(
    context: LifecycleContext,
    input: Omit<WriteMetricInput, "opportunity_id" | "organization_id">,
  ): Promise<VgMetric> {
    const { opportunityId, organizationId } = this.getSafeContext(context);
    return this.service.writeMetric({
      ...input,
      opportunity_id: opportunityId,
      organization_id: organizationId,
    });
  }

  /**
   * Upserts a VgValueDriver node. Injects opportunity_id and organization_id
   * from the LifecycleContext automatically.
   */
  async writeValueDriver(
    context: LifecycleContext,
    input: Omit<WriteValueDriverInput, "opportunity_id" | "organization_id">,
  ): Promise<VgValueDriver> {
    const { opportunityId, organizationId } = this.getSafeContext(context);
    return this.service.writeValueDriver({
      ...input,
      opportunity_id: opportunityId,
      organization_id: organizationId,
    });
  }

  /**
   * Upserts a typed edge between two graph entities. Injects opportunity_id
   * and organization_id from the LifecycleContext automatically.
   */
  async writeEdge(
    context: LifecycleContext,
    input: Omit<WriteEdgeInput, "opportunity_id" | "organization_id">,
  ): Promise<ValueGraphEdge> {
    const { opportunityId, organizationId } = this.getSafeContext(context);
    return this.service.writeEdge({
      ...input,
      opportunity_id: opportunityId,
      organization_id: organizationId,
    });
  }
}
