/**
 * Capability Resolver
 *
 * Agent-facing interface for the Tenant-Safe Secret Layer.
 *
 * Agents request CAPABILITIES (e.g. "salesforce.read"), not raw secrets.
 * This decouples agent logic from secret storage and prevents agents from
 * ever receiving or reasoning about credential values.
 *
 * SECURITY INVARIANTS:
 *  - Agents NEVER receive decrypted values — only tool executors do
 *  - Every request is validated against the SecretBroker before execution
 *  - Denied requests throw SecretAccessDeniedError with a structured reason
 *
 * Design ref: tenant_safe_secret_layer_design_brief.md §§ Agent + Tool Integration Layer,
 *             Core Principle 2 (Capability-Based Access)
 */

import { createLogger } from '../../lib/logger.js';
import { SecretAccessDeniedError, getSecretBrokerService } from './SecretBrokerService.js';
import type {
  SecretAccessGrant,
  SecretAccessRequest,
  SecretBrokerDecision,
  SecretEnvironment,
} from './TenantSecretTypes.js';

const logger = createLogger({ component: 'CapabilityResolver' });

// ---------------------------------------------------------------------------
// Capability Request Context
// ---------------------------------------------------------------------------

/**
 * Context provided by the agent runtime when requesting a capability.
 * Populated from the workflow execution context — agents do not construct this.
 */
export interface CapabilityRequestContext {
  /** Tenant (organization) ID — injected by the runtime, never by the agent. */
  tenantId: string;
  /** Agent identifier from the orchestration layer. */
  agentId: string;
  /** Workflow execution ID for traceability. */
  workflowId?: string;
  /** Individual run ID within the workflow. */
  runId?: string;
  /** Deployment environment. */
  environment: SecretEnvironment;
}

// ---------------------------------------------------------------------------
// CapabilityResolver
// ---------------------------------------------------------------------------

export class CapabilityResolver {
  private readonly broker = getSecretBrokerService();

  /**
   * Request a capability on behalf of a tool executor.
   *
   * Returns an ephemeral SecretAccessGrant when the request is allowed.
   * Throws SecretAccessDeniedError when denied.
   *
   * USAGE PATTERN (tool executor only — NOT agent code):
   * ```ts
   * const grant = await capabilityResolver.requestCapability(
   *   'salesforce.read',
   *   'salesforce_query_tool',
   *   'Fetch opportunity pipeline for ROI analysis',
   *   ctx
   * );
   * // grant.decryptedValue is available here — use it, do NOT log it
   * ```
   */
  async requestCapability(
    capability: string,
    toolName: string,
    purpose: string,
    ctx: CapabilityRequestContext
  ): Promise<SecretAccessGrant> {
    const request: SecretAccessRequest = {
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      workflowId: ctx.workflowId,
      runId: ctx.runId,
      capability,
      purpose,
      toolName,
      environment: ctx.environment,
    };

    const decision: SecretBrokerDecision = await this.broker.resolve(request);

    if (decision.decision === 'deny') {
      logger.warn('CapabilityResolver: capability denied', {
        tenantId: ctx.tenantId,
        agentId: ctx.agentId,
        capability,
        toolName,
        reason: decision.reason,
        workflowId: ctx.workflowId,
        runId: ctx.runId,
      });
      throw new SecretAccessDeniedError(decision.reason, decision.message, {
        capability,
        toolName,
        agentId: ctx.agentId,
        tenantId: ctx.tenantId,
      });
    }

    return decision.grant;
  }

  /**
   * Check whether a capability would be granted without actually issuing a grant.
   * Useful for pre-flight checks in workflow planning — does NOT write an audit record.
   *
   * NOTE: This is a dry-run; the result may differ from the actual resolve() call
   * if the secret record changes between the check and execution.
   */
  async canResolve(
    capability: string,
    toolName: string,
    purpose: string,
    ctx: CapabilityRequestContext
  ): Promise<boolean> {
    try {
      const grant = await this.requestCapability(capability, toolName, purpose, ctx);
      // We have a grant but we're in dry-run mode — discard the decrypted value immediately
      void grant.grantId; // reference to prevent lint warnings
      return true;
    } catch (err) {
      if (err instanceof SecretAccessDeniedError) {
        return false;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: CapabilityResolver | null = null;

export function getCapabilityResolver(): CapabilityResolver {
  if (!_instance) {
    _instance = new CapabilityResolver();
  }
  return _instance;
}

export function resetCapabilityResolverForTests(): void {
  _instance = null;
}
