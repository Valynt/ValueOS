/**
 * Intent Types
 * 
 * Types for intent recognition, classification, and routing
 */

export interface Intent {
  id: string;
  type?: string;
  name: string;
  description: string;
  category: IntentCategory;
  lifecycle_stage?: string;
  confidence_threshold: number;
  training_examples: string[];
  data?: Record<string, unknown>;
}

export type IntentCategory =
  | 'navigation'
  | 'query'
  | 'action'
  | 'creation'
  | 'modification'
  | 'deletion'
  | 'analysis';

export interface IntentRecognitionResult {
  intent_id: string;
  intent_name: string;
  confidence: number;
  entities: ExtractedEntity[];
  context: Record<string, any>;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  start_position?: number;
  end_position?: number;
}

export interface IntentRoutingDecision {
  target_agent?: string;
  target_workflow?: string;
  target_service?: string;
  parameters: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
}

export interface IntentCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'exists';
  value?: unknown;
}

export interface IntentParameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export type IntentType = string;

export interface IntentNode {
  id: string;
  type: IntentType;
  intent?: string;
  parameters?: IntentParameter[];
  conditions?: IntentCondition[];
  [key: string]: unknown;
}

export interface IntentGraph {
  nodes: IntentNode[];
  edges: Array<{ from: string; to: string }>;
  root?: IntentNode | string;
  [key: string]: unknown;
}

export interface IntentRegistryEntry {
  id?: string;
  name?: string;
  type?: IntentType;
  intentType: IntentType;
  component: string;
  handler?: string;
  fallback?: string;
  conditions?: IntentCondition[];
  priority?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IntentRegistryConfig {
  entries?: IntentRegistryEntry[];
  intents: IntentRegistryEntry[];
  version?: string;
  defaultFallback?: string;
}

export interface IntentResolution {
  intentId: string;
  handler: string;
  parameters: Record<string, unknown>;
  component?: string;
  [key: string]: unknown;
}

export interface PropTransform {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
}

export interface HistoricalIntentMatch {
  intentId: string;
  timestamp: string;
  confidence: number;
}

export interface ClarificationPayload {
  question?: string;
  message?: string;
  options?: string[];
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Factory helper to construct a partial Intent with required defaults. */
export function createIntent(
  name: string,
  data?: Record<string, unknown>,
  options?: Partial<Pick<Intent, 'category' | 'confidence_threshold'>> & Record<string, unknown>,
  source?: string
): Intent {
  return {
    id: `${name}-${Date.now()}`,
    name,
    description: name,
    category: (options?.category as IntentCategory) ?? 'action',
    confidence_threshold: (options?.confidence_threshold as number) ?? 0.7,
    training_examples: [],
    data: { ...data, source },
  };
}
