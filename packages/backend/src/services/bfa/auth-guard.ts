/**
 * Backend for Agents (BFA) Authorization Guard
 *
 * Centralized permission enforcement for semantic tools.
 * Provides RBAC checks and audit logging for all BFA operations.
 */

import { logger } from "../../lib/logger.js"

import { assertAuthorized } from '../policy/AuthorizationPolicyGateway.js';
import { toolRegistry } from "./registry.js"
import { AgentContext, AuthorizationError } from "./types.js"

/**
 * Authorization guard for enforcing access control
 */
export class AuthGuard {
  /**
   * Check if a user can execute a specific tool
   */
  static async canExecute(
    toolId: string,
    context: AgentContext
  ): Promise<void> {
    const tool = toolRegistry.get(toolId);
    if (!tool) {
      throw new AuthorizationError(`Tool '${toolId}' not found`, []);
    }

    // Unified authorization policy gateway (canonical auth path)
    try {
      const decision = assertAuthorized({
        domain: 'bfa_tool_execution',
        action: tool.policy.action,
        resource: tool.policy.resource,
        agentType: 'default',
        actorId: context.userId,
        actorPermissions: context.permissions,
        requiredPermissions: tool.policy.requiredPermissions || [],
        tenantId: context.tenantId,
        traceId: context.sessionId,
        invocationId: `${context.userId}:${toolId}:${context.requestTime.getTime()}`,
        metadata: { toolId },
      });

      logger.info("Authorization allowed for tool execution", {
        toolId,
        userId: context.userId,
        tenantId: context.tenantId,
        decisionId: decision.decisionId,
        policyVersion: decision.policyVersion,
      });
    } catch (error) {
      logger.warn("Authorization denied for tool execution", {
        toolId,
        userId: context.userId,
        tenantId: context.tenantId,
        requiredPermissions: tool.policy.requiredPermissions || [],
        userPermissions: context.permissions,
        decisionId:
          error instanceof Error && 'details' in error
            ? (error as { details?: Record<string, unknown> }).details?.decisionId
            : undefined,
      });

      throw new AuthorizationError(
        `Insufficient permissions for tool '${toolId}'`,
        tool.policy.requiredPermissions || []
      );
    }

    // Additional business logic checks can be added here
    await this.performBusinessLogicChecks(toolId, context);
  }

  /**
   * Execute a tool with authorization checks
   */
  static async executeWithAuth<TInput, TOutput>(
    toolId: string,
    input: TInput,
    context: AgentContext
  ): Promise<TOutput> {
    // Pre-execution authorization check
    await this.canExecute(toolId, context);

    const tool = toolRegistry.get<TInput, TOutput>(toolId);
    if (!tool) {
      throw new AuthorizationError(`Tool '${toolId}' not found`, []);
    }

    // Log the execution attempt
    logger.info("Executing semantic tool with authorization", {
      toolId,
      userId: context.userId,
      tenantId: context.tenantId,
      resource: tool.policy.resource,
      action: tool.policy.action,
    });

    try {
      const result = await tool.execute(input, context);

      // Log successful execution
      logger.info("Semantic tool executed successfully", {
        toolId,
        userId: context.userId,
        tenantId: context.tenantId,
        executionTimeMs: Date.now() - context.requestTime.getTime(),
      });

      return result;
    } catch (error) {
      // Log execution failure
      logger.error(
        "Semantic tool execution failed",
        error instanceof Error ? error : undefined,
        {
          toolId,
          userId: context.userId,
          tenantId: context.tenantId,
        }
      );

      throw error;
    }
  }

  /**
   * Perform additional business logic checks
   */
  private static async performBusinessLogicChecks(
    toolId: string,
    context: AgentContext
  ): Promise<void> {
    // Add tenant-specific checks here
    // For example: check if tenant is active, has sufficient quota, etc.
    // Placeholder for future business logic validations
    // This could include:
    // - Tenant status checks
    // - Rate limiting validation
    // - Resource quota validation
    // - Geographic restrictions
    // - Time-based restrictions
  }

  /**
   * Get available tools for a user
   */
  static getAvailableTools(
    context: AgentContext
  ): Array<{ id: string; description: string }> {
    return toolRegistry.getAvailableTools(context);
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(permission: string, context: AgentContext): boolean {
    return context.permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(
    permissions: string[],
    context: AgentContext
  ): boolean {
    return permissions.some((permission) =>
      context.permissions.includes(permission)
    );
  }

  /**
   * Check if user has all specified permissions
   */
  static hasAllPermissions(
    permissions: string[],
    context: AgentContext
  ): boolean {
    return permissions.every((permission) =>
      context.permissions.includes(permission)
    );
  }
}
