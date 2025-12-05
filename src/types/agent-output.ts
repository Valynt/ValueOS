/**
 * Agent Output Types
 * 
 * Defines the structure of outputs from different agents in the system.
 */

import { LifecycleStage } from './workflow';
import { SystemMap, InterventionPoint, OutcomeHypothesis, FeedbackLoop } from './sof';

/**
 * Base agent output interface
 */
export interface BaseAgentOutput {
  agentId: string;
  agentType: string;
  timestamp: number;
  workspaceId: string;
  lifecycleStage: LifecycleStage;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * System Mapper Agent output
 */
export interface SystemMapperOutput extends BaseAgentOutput {
  agentType: 'SystemMapperAgent';
  systemMap: SystemMap;
  entities: any[];
  relationships: any[];
  leveragePoints: any[];
  constraints: any[];
  insights: string[];
}

/**
 * Intervention Designer Agent output
 */
export interface TargetOutput extends BaseAgentOutput {
  agentType: 'TargetAgent';
  interventions: InterventionPoint[];
  recommendations: string[];
  feasibilityScores: Record<string, number>;
}

/**
 * Outcome Engineer Agent output
 */
export interface OpportunityOutput extends BaseAgentOutput {
  agentType: 'OpportunityAgent';
  hypotheses: OutcomeHypothesis[];
  kpis: any[];
  assumptions: any[];
  confidenceScores: Record<string, number>;
}

/**
 * Realization Loop Agent output
 */
export interface RealizationOutput extends BaseAgentOutput {
  agentType: 'RealizationAgent';
  feedbackLoops: FeedbackLoop[];
  metrics: any[];
  behaviorChanges: any[];
  realizationStatus: string;
}

/**
 * Value Eval Agent output
 */
export interface IntegrityOutput extends BaseAgentOutput {
  agentType: 'IntegrityAgent';
  scores: Record<string, number>;
  recommendations: string[];
  risks: any[];
  opportunities: any[];
}

/**
 * Coordinator Agent output
 */
export interface CoordinatorOutput extends BaseAgentOutput {
  agentType: 'CoordinatorAgent';
  layoutDirective: any;
  nextSteps: string[];
  agentsInvoked: string[];
}

/**
 * Union type for all agent outputs
 */
export type AgentOutput =
  | SystemMapperOutput
  | TargetOutput
  | OpportunityOutput
  | RealizationOutput
  | IntegrityOutput
  | CoordinatorOutput;

/**
 * Component impact analysis result
 */
export interface ComponentImpact {
  componentId: string;
  componentType: string;
  impactType: 'add' | 'update' | 'remove' | 'reorder';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  affectedProps?: string[];
}

/**
 * SDUI update from agent output
 */
export interface AgentSDUIUpdate {
  agentId: string;
  agentType: string;
  workspaceId: string;
  updateType: 'full_schema' | 'atomic_actions' | 'partial_update';
  schema?: any;
  atomicActions?: any[];
  impacts: ComponentImpact[];
  timestamp: number;
}
