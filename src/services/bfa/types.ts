/**
 * Backend for Agents (BFA) Core Types
 * 
 * This module defines the semantic tool interface and related types
 * for the Backend for Agents pattern in ValueOS.
 */

import { z } from 'zod';

/**
 * Agent execution context containing authentication and tenant information
 */
export interface AgentContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  permissions: string[];
  requestTime: Date;
}

/**
 * Authorization policy for semantic tools (OpenFGA style)
 */
export interface AuthPolicy {
  resource: string;
  action: string;
  requiredPermissions?: string[];
}

/**
 * Core interface for all BFA semantic tools
 * 
 * Semantic tools provide high-level business operations instead of raw CRUD.
 * They enforce security, validation, and business logic at the semantic layer.
 */
export interface SemanticTool<TInput, TOutput> {
  /** Unique identifier for the tool */
  id: string;
  
  /** LLM-optimized description of what the tool does */
  description: string;
  
  /** Zod schema for input validation */
  inputSchema: z.ZodSchema<TInput>;
  
  /** Zod schema for output validation */
  outputSchema: z.ZodSchema<TOutput>;
  
  /** Authorization policy for this tool */
  policy: AuthPolicy;
  
  /** Execute the semantic operation */
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
  
  /** Optional telemetry configuration */
  telemetry?: {
    trackMetrics?: boolean;
    logInputs?: boolean;
    logOutputs?: boolean;
  };
}

/**
 * Tool execution result with metadata
 */
export interface ToolExecutionResult<TOutput> {
  /** The actual output data */
  data: TOutput;
  
  /** Execution metadata */
  metadata: {
    executionTimeMs: number;
    toolId: string;
    userId: string;
    tenantId: string;
    success: boolean;
  };
  
  /** Optional warnings or information */
  warnings?: string[];
}

/**
 * Error types for BFA operations
 */
export class BFAError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BFAError';
  }
}

export class AuthorizationError extends BFAError {
  constructor(message: string, public requiredPermissions: string[]) {
    super(message, 'AUTHORIZATION_ERROR', { requiredPermissions });
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends BFAError {
  constructor(message: string, public validationErrors: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}

export class BusinessLogicError extends BFAError {
  constructor(message: string, public businessRule: string) {
    super(message, 'BUSINESS_LOGIC_ERROR', { businessRule });
    this.name = 'BusinessLogicError';
  }
}

/**
 * Tool registry interface for discovering and managing semantic tools
 */
export interface ToolRegistry {
  /** Register a new semantic tool */
  register<TInput, TOutput>(tool: SemanticTool<TInput, TOutput>): void;
  
  /** Get a tool by ID */
  get<TInput, TOutput>(toolId: string): SemanticTool<TInput, TOutput> | undefined;
  
  /** List all available tools */
  list(): Array<{ id: string; description: string; policy: AuthPolicy }>;
  
  /** Check if a user has permission to use a tool */
  canUse(toolId: string, context: AgentContext): boolean;
}
