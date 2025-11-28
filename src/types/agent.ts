/**
 * Canonical Agent Interface
 * 
 * CONSOLIDATION: This file defines the unified agent interface that all agents
 * should implement. It consolidates the following:
 * - Primary agents (src/agents/*.ts)
 * - Agent-fabric agents (src/lib/agent-fabric/agents/*.ts)
 * 
 * Migration Guide:
 * - All new agents should implement IAgent
 * - Existing agents should be migrated to implement IAgent
 * - Use AgentRegistration for registry integration
 */

import { z } from 'zod';

// ============================================================================
// Core Agent Types
// ============================================================================

/**
 * Agent lifecycle stages in the VOS (Value Operating System)
 */
export type LifecycleStage =
  | 'opportunity'
  | 'target'
  | 'realization'
  | 'expansion'
  | 'integrity'
  | 'financial-modeling'
  | 'company-intelligence'
  | 'value-mapping'
  | 'system-mapper'
  | 'intervention-designer'
  | 'outcome-engineer'
  | 'coordinator';

/**
 * Agent type union - all supported agent types
 */
export type AgentType =
  | 'opportunity'
  | 'target'
  | 'realization'
  | 'expansion'
  | 'integrity'
  | 'financial-modeling'
  | 'company-intelligence'
  | 'value-mapping'
  | 'system-mapper'
  | 'intervention-designer'
  | 'outcome-engineer'
  | 'coordinator'
  | 'value-eval'
  | 'communicator';

/**
 * Confidence levels for agent outputs
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Agent health status
 */
export type AgentHealthStatus = 'healthy' | 'degraded' | 'offline';

// ============================================================================
// Agent Input/Output Types
// ============================================================================

/**
 * Base input type for all agent executions
 */
export interface AgentInput {
  /** Session identifier for tracking */
  sessionId: string;
  /** User identifier */
  userId?: string;
  /** The query or task description */
  query: string;
  /** Additional context for the agent */
  context?: Record<string, any>;
  /** Conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
}

/**
 * Base output type for all agent executions
 */
export interface AgentOutput<T = any> {
  /** Whether the execution was successful */
  success: boolean;
  /** The result data */
  result: T;
  /** Confidence level of the output */
  confidenceLevel: ConfidenceLevel;
  /** Numerical confidence score (0-1) */
  confidenceScore: number;
  /** Reasoning trace for explainability */
  reasoning?: string;
  /** Evidence supporting the output */
  evidence?: Array<{
    source: string;
    description: string;
    confidence: number;
  }>;
  /** Assumptions made during execution */
  assumptions?: string[];
  /** Data gaps identified */
  dataGaps?: string[];
  /** Error message if not successful */
  error?: string;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
  /** Suggested next stage (for workflow progression) */
  nextStage?: string;
}

/**
 * Secure agent output with hallucination detection
 */
export interface SecureAgentOutput<T = any> extends AgentOutput<T> {
  /** Whether hallucination was detected */
  hallucinationCheck: boolean;
  /** Specific hallucination indicators */
  hallucinationIndicators?: string[];
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Canonical Agent Interface
 * 
 * All agents (primary and fabric) should implement this interface.
 */
export interface IAgent {
  /** Unique identifier for this agent instance */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** VOS lifecycle stage this agent operates in */
  readonly lifecycleStage: LifecycleStage;
  
  /** Agent version for compatibility tracking */
  readonly version: string;
  
  /** Capabilities this agent provides */
  readonly capabilities: string[];
  
  /**
   * Execute the agent's primary function
   * 
   * @param input Agent input
   * @returns Agent output with result and metadata
   */
  execute(input: AgentInput): Promise<AgentOutput>;
  
  /**
   * Check if the agent can handle a specific query
   * 
   * @param query The query to check
   * @param context Optional context
   * @returns True if the agent can handle this query
   */
  canHandle(query: string, context?: Record<string, any>): boolean;
  
  /**
   * Get agent health status
   * 
   * @returns Current health status
   */
  getHealthStatus(): Promise<AgentHealthStatus>;
}

/**
 * Extended agent interface with secure invocation
 */
export interface ISecureAgent extends IAgent {
  /**
   * Execute with secure output validation
   * 
   * @param input Agent input
   * @param outputSchema Zod schema for output validation
   * @returns Secure agent output with hallucination detection
   */
  secureExecute<T>(
    input: AgentInput,
    outputSchema: z.ZodType<T>
  ): Promise<SecureAgentOutput<T>>;
}

// ============================================================================
// Agent Registration
// ============================================================================

/**
 * Agent registration data for the AgentRegistry
 */
export interface AgentRegistration {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Lifecycle stage */
  lifecycleStage: LifecycleStage;
  /** Capabilities provided */
  capabilities: string[];
  /** Optional region for routing */
  region?: string;
  /** Optional endpoint for remote agents */
  endpoint?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent record with runtime state
 */
export interface AgentRecord extends AgentRegistration {
  /** Current load (0-1) */
  load: number;
  /** Current health status */
  status: AgentHealthStatus;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Active sticky sessions */
  stickySessions: Set<string>;
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Factory function type for creating agents
 */
export type AgentFactory = (config: AgentConfig) => IAgent;

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent identifier */
  id: string;
  /** LLM gateway instance */
  llmGateway?: any;
  /** Memory system instance */
  memorySystem?: any;
  /** Audit logger instance */
  auditLogger?: any;
  /** Supabase client */
  supabase?: any;
  /** Additional configuration */
  options?: Record<string, any>;
}

// ============================================================================
// Agent Capability Definitions
// ============================================================================

/**
 * Standard agent capabilities
 */
export const AGENT_CAPABILITIES = {
  // Discovery capabilities
  DISCOVER_PAIN_POINTS: 'discover_pain_points',
  ANALYZE_TRANSCRIPTS: 'analyze_transcripts',
  MAP_PERSONAS: 'map_personas',
  
  // Analysis capabilities
  SYSTEM_MAPPING: 'system_mapping',
  DEPENDENCY_ANALYSIS: 'dependency_analysis',
  BOTTLENECK_IDENTIFICATION: 'bottleneck_identification',
  
  // Design capabilities
  INTERVENTION_DESIGN: 'intervention_design',
  SOLUTION_ARCHITECTURE: 'solution_architecture',
  
  // Financial capabilities
  ROI_CALCULATION: 'roi_calculation',
  SCENARIO_MODELING: 'scenario_modeling',
  FINANCIAL_PROJECTION: 'financial_projection',
  
  // Realization capabilities
  OUTCOME_TRACKING: 'outcome_tracking',
  VALUE_REALIZATION: 'value_realization',
  
  // Expansion capabilities
  GROWTH_OPPORTUNITY: 'growth_opportunity',
  EXPANSION_PLANNING: 'expansion_planning',
  
  // Coordination capabilities
  TASK_PLANNING: 'task_planning',
  AGENT_ROUTING: 'agent_routing',
  SDUI_GENERATION: 'sdui_generation',
} as const;

export type AgentCapability = typeof AGENT_CAPABILITIES[keyof typeof AGENT_CAPABILITIES];

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Agent input schema for validation
 */
export const AgentInputSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  query: z.string(),
  context: z.record(z.any()).optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
});

/**
 * Agent output schema for validation
 */
export const AgentOutputSchema = z.object({
  success: z.boolean(),
  result: z.any(),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  evidence: z.array(z.object({
    source: z.string(),
    description: z.string(),
    confidence: z.number(),
  })).optional(),
  assumptions: z.array(z.string()).optional(),
  dataGaps: z.array(z.string()).optional(),
  error: z.string().optional(),
  processingTimeMs: z.number().optional(),
  nextStage: z.string().optional(),
});
