/**
 * Tool Registry with MCP-Compatible Interface
 * 
 * Implements Model Context Protocol (MCP) compatible tool interface
 * for hot-swappable tools without orchestrator refactoring.
 * 
 * Based on:
 * - Anthropic's Model Context Protocol (MCP)
 * - OpenAI Function Calling specification
 * - Industry standard tool interfaces
 */

import { logger } from '../utils/logger';

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: any[];
  [key: string]: any;
}

/**
 * MCP-compatible tool interface
 */
export interface MCPTool {
  /** Unique tool identifier */
  name: string;
  
  /** Human-readable description of what the tool does */
  description: string;
  
  /** JSON Schema defining the tool's parameters */
  parameters: JSONSchema;
  
  /** Execute the tool with given parameters */
  execute(params: any, context?: ToolExecutionContext): Promise<ToolResult>;
  
  /** Optional: Validate parameters before execution */
  validate?(params: any): Promise<ValidationResult>;
  
  /** Optional: Tool metadata */
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  };
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  workflowId?: string;
  agentType?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    cost?: number;
    tokensUsed?: number;
    cached?: boolean;
  };
}

/**
 * Parameter validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Tool Registry
 * 
 * Central registry for all tools with hot-swap capability
 */
export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private executionHistory: Map<string, number> = new Map();
  private rateLimitWindows: Map<string, number[]> = new Map();

  /**
   * Register a tool
   */
  register(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn('Tool already registered, replacing', { toolName: tool.name });
    }

    // Validate tool interface
    this.validateToolInterface(tool);

    this.tools.set(tool.name, tool);

    logger.info('Tool registered', {
      name: tool.name,
      category: tool.metadata?.category,
      version: tool.metadata?.version,
    });
  }

  /**
   * Unregister a tool (hot-swap)
   */
  unregister(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    
    if (removed) {
      logger.info('Tool unregistered', { toolName });
    }

    return removed;
  }

  /**
   * Get a tool by name
   */
  get(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * List all registered tools
   */
  list(category?: string): MCPTool[] {
    const tools = Array.from(this.tools.values());
    
    if (category) {
      return tools.filter(t => t.metadata?.category === category);
    }
    
    return tools;
  }

  /**
   * Execute a tool
   */
  async execute(
    toolName: string,
    params: any,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool not found: ${toolName}`,
        },
      };
    }

    // Check rate limits
    const rateLimitResult = this.checkRateLimit(tool, context?.userId);
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: rateLimitResult.message || 'Rate limit exceeded',
          details: { retryAfter: rateLimitResult.retryAfter },
        },
      };
    }

    // Validate parameters
    if (tool.validate) {
      const validation = await tool.validate(params);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Parameter validation failed',
            details: { errors: validation.errors },
          },
        };
      }
    }

    // Execute tool
    const startTime = Date.now();
    
    try {
      logger.info('Executing tool', {
        toolName,
        userId: context?.userId,
        workflowId: context?.workflowId,
      });

      const result = await tool.execute(params, context);

      const duration = Date.now() - startTime;

      // Track execution
      this.trackExecution(toolName, context?.userId);

      logger.info('Tool execution completed', {
        toolName,
        success: result.success,
        duration,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Tool execution failed', {
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          duration,
        },
      };
    }
  }

  /**
   * Validate tool interface
   */
  private validateToolInterface(tool: MCPTool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a description');
    }

    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error('Tool must have parameters schema');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(
    tool: MCPTool,
    userId?: string
  ): { allowed: boolean; message?: string; retryAfter?: number } {
    if (!tool.metadata?.rateLimit) {
      return { allowed: true };
    }

    const key = `${tool.name}:${userId || 'anonymous'}`;
    const now = Date.now();
    const window = tool.metadata.rateLimit.windowMs;
    const maxCalls = tool.metadata.rateLimit.maxCalls;

    // Get or create window
    let calls = this.rateLimitWindows.get(key) || [];

    // Remove old calls outside window
    calls = calls.filter(timestamp => now - timestamp < window);

    // Check limit
    if (calls.length >= maxCalls) {
      const oldestCall = Math.min(...calls);
      const retryAfter = Math.ceil((oldestCall + window - now) / 1000);

      return {
        allowed: false,
        message: `Rate limit exceeded. Max ${maxCalls} calls per ${window}ms`,
        retryAfter,
      };
    }

    // Add current call
    calls.push(now);
    this.rateLimitWindows.set(key, calls);

    return { allowed: true };
  }

  /**
   * Track tool execution
   */
  private trackExecution(toolName: string, userId?: string): void {
    const key = `${toolName}:${userId || 'anonymous'}`;
    const count = this.executionHistory.get(key) || 0;
    this.executionHistory.set(key, count + 1);
  }

  /**
   * Get tool execution statistics
   */
  getStatistics(toolName?: string): {
    totalExecutions: number;
    byTool: Record<string, number>;
  } {
    let totalExecutions = 0;
    const byTool: Record<string, number> = {};

    for (const [key, count] of this.executionHistory.entries()) {
      const [tool] = key.split(':');
      
      if (toolName && tool !== toolName) continue;

      totalExecutions += count;
      byTool[tool] = (byTool[tool] || 0) + count;
    }

    return { totalExecutions, byTool };
  }

  /**
   * Convert tools to OpenAI function format
   */
  toOpenAIFunctions(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Convert tools to Anthropic tool format
   */
  toAnthropicTools(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.executionHistory.clear();
    this.rateLimitWindows.clear();
    logger.info('Tool registry cleared');
  }
}

/**
 * Abstract base class for tools
 */
export abstract class BaseTool implements MCPTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: JSONSchema;
  abstract execute(params: any, context?: ToolExecutionContext): Promise<ToolResult>;

  metadata?: MCPTool['metadata'];

  async validate(params: any): Promise<ValidationResult> {
    // Basic validation against JSON schema
    const errors: string[] = [];

    if (this.parameters.required) {
      for (const field of this.parameters.required) {
        if (!(field in params)) {
          errors.push(`Missing required parameter: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
