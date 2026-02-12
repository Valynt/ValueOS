/**
 * Backend for Agents (BFA) Authorization Guard
 *
 * Centralized permission enforcement for semantic tools.
 * Provides RBAC checks and audit logging for all BFA operations.
 */

import { AgentContext, AuthorizationError } from "./types.js"
import { toolRegistry } from "./registry.js"
import { logger } from "../../lib/logger.js"

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

    // Check basic permissions
    if (!toolRegistry.canUse(toolId, context)) {
      logger.warn("Authorization denied for tool execution", {
        toolId,
        userId: context.userId,
        tenantId: context.tenantId,
        requiredPermissions: tool.policy.requiredPermissions || [],
        userPermissions: context.permissions,
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
