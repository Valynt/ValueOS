/**
 * Shared types for the agentic middleware layer.
 */

import type { IntentCategory } from '../../types/intent.js';
import type { AgentType } from '../agent-types.js';

// ============================================================================
// Intent Graph (Semantic Intent Middleware)
// ============================================================================

export interface IntentParameter {
  name: string;
  type: 'string' | 'number' | 'enum' | 'entity';
  required: boolean;
  value?: unknown;
  description: string;
  enumValues?: string[];
}

export interface IntentNode {
  id: string;
  intent: string;
  confidence: number;
  category: IntentCategory;
  parameters: IntentParameter[];
  children: IntentNode[];
}

export interface HistoricalIntentMatch {
  intentId: string;
  similarity: number;
  previousAgent: string;
  wasSuccessful: boolean;
}

export interface IntentGraph {
  root: IntentNode;
  ambiguityScore: number;
  missingParameters: IntentParameter[];
  resolvedAgent: AgentType | null;
  historicalMatches: HistoricalIntentMatch[];
}

// ============================================================================
// Clarification (Semantic Intent Middleware)
// ============================================================================

export interface ClarificationPayload {
  message: string;
  missingParameters: IntentParameter[];
  suggestedIntent: string;
  confidence: number;
  originalQuery: string;
}

// ============================================================================
// Refinement Metadata (Adaptive Refinement Middleware)
// ============================================================================

export interface RefinementMetadata {
  wasRefined: boolean;
  originalScore: number;
  refinedScore?: number;
  originalModel: string;
  refinedModel?: string;
  costIncrease?: number;
  refinementPlan?: string[];
}

// ============================================================================
// Reasoning Step (Reasoning Logger Middleware)
// ============================================================================

export interface ReasoningStep {
  id: string;
  type: 'reasoning' | 'action' | 'observation' | 'decision' | 'tool_use';
  content: string;
  timestamp: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}
