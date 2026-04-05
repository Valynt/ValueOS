/**
 * Secret-Aware Tool Executor
 *
 * Wraps tool execution with automatic capability resolution.
 * Tools declare the capabilities they require; this executor resolves
 * them through the SecretBroker before invoking the tool handler.
 *
 * SECURITY INVARIANTS:
 *  - Decrypted credentials are injected ONLY into the tool handler function
 *  - Credentials are never stored in memory beyond the handler invocation
 *  - Credentials are never passed back to the caller or agent
 *  - Tool handlers receive credentials via a dedicated SecretContext argument,
 *    not via the shared params object (which may be logged)
 *
 * Design ref: tenant_safe_secret_layer_design_brief.md §§ Agent + Tool Integration Layer,
 *             Core Principle 3 (Zero Secret Exposure to Models)
 */

import { createLogger } from '../../lib/logger.js';
import { CapabilityRequestContext, getCapabilityResolver } from './CapabilityResolver.js';
import { SecretAccessDeniedError } from './SecretBrokerService.js';
import type { SecretAccessGrant } from './TenantSecretTypes.js';

const logger = createLogger({ component: 'SecretAwareToolExecutor' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Resolved secrets injected into the tool handler.
 * Keys are capability strings; values are ephemeral grants.
 *
 * SECURITY: This object MUST NOT be logged, serialized, or returned to callers.
 */
export type SecretContext = Record<string, SecretAccessGrant>;

/**
 * Declaration of capabilities required by a tool.
 */
export interface CapabilityRequirement {
  /** Capability string, e.g. "salesforce.read". */
  capability: string;
  /** Purpose declaration for audit logging. */
  purpose: string;
}

/**
 * A tool handler that receives resolved secrets alongside its parameters.
 */
export type SecretAwareToolHandler<TParams, TResult> = (
  params: TParams,
  secrets: SecretContext
) => Promise<TResult>;

/**
 * Result of a secret-aware tool execution.
 */
export interface SecretAwareToolResult<TResult> {
  success: boolean;
  result?: TResult;
  error?: {
    code: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// SecretAwareToolExecutor
// ---------------------------------------------------------------------------

export class SecretAwareToolExecutor {
  private readonly resolver = getCapabilityResolver();

  /**
   * Execute a tool handler with automatically resolved credentials.
   *
   * @param toolName - Unique tool identifier (used in audit log and policy checks)
   * @param requiredCapabilities - Capabilities the tool needs; all must be granted
   * @param params - Tool-specific parameters (safe to log; must NOT contain secrets)
   * @param ctx - Capability request context from the workflow runtime
   * @param handler - Tool handler that receives resolved secrets
   */
  async execute<TParams, TResult>(
    toolName: string,
    requiredCapabilities: CapabilityRequirement[],
    params: TParams,
    ctx: CapabilityRequestContext,
    handler: SecretAwareToolHandler<TParams, TResult>
  ): Promise<SecretAwareToolResult<TResult>> {
    // Step 1 — resolve all required capabilities
    const secretContext: SecretContext = {};

    for (const req of requiredCapabilities) {
      try {
        const grant = await this.resolver.requestCapability(
          req.capability,
          toolName,
          req.purpose,
          ctx
        );
        secretContext[req.capability] = grant;
      } catch (err) {
        if (err instanceof SecretAccessDeniedError) {
          logger.warn('SecretAwareToolExecutor: capability denied, aborting tool execution', {
            toolName,
            capability: req.capability,
            reason: err.reason,
            tenantId: ctx.tenantId,
            agentId: ctx.agentId,
          });
          return {
            success: false,
            error: {
              code: err.reason,
              message: err.message,
            },
          };
        }
        throw err;
      }
    }

    // Step 2 — invoke the handler with resolved secrets
    try {
      const result = await handler(params, secretContext);

      logger.info('SecretAwareToolExecutor: tool execution succeeded', {
        toolName,
        tenantId: ctx.tenantId,
        agentId: ctx.agentId,
        workflowId: ctx.workflowId,
        runId: ctx.runId,
        capabilities: requiredCapabilities.map((r) => r.capability),
      });

      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('SecretAwareToolExecutor: tool handler threw', err instanceof Error ? err : undefined, {
        toolName,
        tenantId: ctx.tenantId,
        agentId: ctx.agentId,
      });
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message,
        },
      };
    } finally {
      // Step 3 — zero out secret context to prevent lingering in memory
      for (const key of Object.keys(secretContext)) {
        // Overwrite decryptedValue with empty string before GC
        if (secretContext[key]) {
          (secretContext[key] as { decryptedValue: string }).decryptedValue = '';
        }
        delete secretContext[key];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: SecretAwareToolExecutor | null = null;

export function getSecretAwareToolExecutor(): SecretAwareToolExecutor {
  if (!_instance) {
    _instance = new SecretAwareToolExecutor();
  }
  return _instance;
}

export function resetSecretAwareToolExecutorForTests(): void {
  _instance = null;
}
