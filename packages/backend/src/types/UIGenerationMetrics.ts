/**
 * UI Generation Metrics Types
 */

export interface UIGenerationMetrics {
  generation_id: string;
  component_count: number;
  generation_time_ms: number;
  complexity_score: number;
  reusability_score: number;
  timestamp: string;
}

export interface UIGenerationTrajectory {
  id: string;
  session_id: string;
  user_id: string;
  tenant_id: string;
  prompt: string;
  components_generated: string[];
  generation_time_ms: number;
  model_used?: string;
  created_at: string;
}

export interface UIInteractionEvent {
  id: string;
  trajectory_id: string;
  component_name: string;
  event_type: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UIGenerationFeedback {
  id: string;
  trajectory_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface ComponentUsageStats {
  component_name: string;
  usage_count: number;
  avg_rating?: number;
  last_used_at: string;
}
