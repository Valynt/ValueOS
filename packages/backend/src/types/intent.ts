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
