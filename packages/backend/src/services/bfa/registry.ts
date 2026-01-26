/**
 * Backend for Agents (BFA) Tool Registry
 * 
 * Central registry for discovering and managing semantic tools.
 * Provides permission checking and tool discovery capabilities.
 */

import { AgentContext, SemanticTool, ToolRegistry } from './types.js'

/**
 * In-memory implementation of the tool registry
 */
export class InMemoryToolRegistry implements ToolRegistry {
  private tools = new Map<string, SemanticTool<any, any>>();
  private toolMetadata = new Map<string, { description: string; policy: any }>();

  /**
   * Register a new semantic tool
   */
  register<TInput, TOutput>(tool: SemanticTool<TInput, TOutput>): void {
    this.tools.set(tool.id, tool);
    this.toolMetadata.set(tool.id, {
      description: tool.description,
      policy: tool.policy
    });
  }

  /**
   * Get a tool by ID
   */
  get<TInput, TOutput>(toolId: string): SemanticTool<TInput, TOutput> | undefined {
    return this.tools.get(toolId) as SemanticTool<TInput, TOutput>;
  }

  /**
   * List all available tools with metadata
   */
  list(): Array<{ id: string; description: string; policy: any }> {
    return Array.from(this.toolMetadata.entries()).map(([id, metadata]) => ({
      id,
      description: metadata.description,
      policy: metadata.policy
    }));
  }

  /**
   * Check if a user has permission to use a tool
   */
  canUse(toolId: string, context: AgentContext): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return false;
    }

    const { requiredPermissions = [] } = tool.policy;
    
    // Check if user has all required permissions
    return requiredPermissions.every(permission => 
      context.permissions.includes(permission)
    );
  }

  /**
   * Get tools available to a specific user
   */
  getAvailableTools(context: AgentContext): Array<{ id: string; description: string }> {
    return this.list()
      .filter(tool => this.canUse(tool.id, context))
      .map(({ id, description }) => ({ id, description }));
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new InMemoryToolRegistry();

/**
 * Decorator for automatically registering semantic tools
 */
export function registerTool<TInput, TOutput>(tool: SemanticTool<TInput, TOutput>): void {
  toolRegistry.register(tool);
}
