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
