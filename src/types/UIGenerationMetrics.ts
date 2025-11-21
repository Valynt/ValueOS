/**
 * UI Generation Metrics Types
 * 
 * Tracks the effectiveness of dynamic UI generation for continuous improvement.
 */

import { z } from 'zod';

export const UIGenerationTrajectorySchema = z.object({
  id: z.string().uuid(),
  subgoal_id: z.string().uuid(),
  
  // Generation details
  generation_method: z.enum(['dynamic', 'static', 'hybrid']),
  llm_model: z.string().optional(),
  tokens_used: z.number().int().optional(),
  generation_time_ms: z.number().int(),
  
  // Component selection
  components_selected: z.array(z.string()),
  layout_chosen: z.string(),
  
  // Decision reasoning
  reasoning: z.string().optional(),
  alternatives_considered: z.array(z.string()).default([]),
  confidence_score: z.number().min(0).max(1),
  
  // Validation
  validation_passed: z.boolean(),
  validation_errors: z.array(z.string()).default([]),
  validation_warnings: z.array(z.string()).default([]),
  
  // Metadata
  created_at: z.string().datetime(),
});

export type UIGenerationTrajectory = z.infer<typeof UIGenerationTrajectorySchema>;

export const UIInteractionEventSchema = z.object({
  id: z.string().uuid(),
  trajectory_id: z.string().uuid(),
  user_id: z.string().uuid(),
  
  // Interaction details
  event_type: z.enum([
    'page_view',
    'component_click',
    'form_submit',
    'navigation',
    'error',
    'task_complete',
    'task_abandon',
  ]),
  
  component_interacted: z.string().optional(),
  interaction_data: z.record(z.any()).default({}),
  
  // Timing
  time_on_page_ms: z.number().int().optional(),
  time_to_interaction_ms: z.number().int().optional(),
  
  // Success indicators
  task_completed: z.boolean().default(false),
  user_satisfaction: z.number().min(1).max(5).optional(),
  
  // Metadata
  created_at: z.string().datetime(),
});

export type UIInteractionEvent = z.infer<typeof UIInteractionEventSchema>;

export const UIGenerationMetricsSchema = z.object({
  trajectory_id: z.string().uuid(),
  
  // Goal completion
  goal_completion_rate: z.number().min(0).max(1),
  task_success: z.boolean(),
  
  // Component effectiveness
  component_selection_accuracy: z.number().min(0).max(1),
  layout_effectiveness: z.number().min(0).max(1),
  
  // User interaction
  user_interaction_success: z.number().min(0).max(1),
  time_to_first_interaction_ms: z.number().int().optional(),
  total_interactions: z.number().int(),
  error_count: z.number().int(),
  
  // Performance
  generation_time_ms: z.number().int(),
  tokens_used: z.number().int().optional(),
  cost_estimate: z.number().optional(),
  
  // Quality scores
  overall_quality_score: z.number().min(0).max(100),
  user_satisfaction_score: z.number().min(1).max(5).optional(),
  
  // Improvement suggestions
  improvement_suggestions: z.array(z.string()).default([]),
  
  // Metadata
  calculated_at: z.string().datetime(),
});

export type UIGenerationMetrics = z.infer<typeof UIGenerationMetricsSchema>;

export const UIGenerationFeedbackSchema = z.object({
  trajectory_id: z.string().uuid(),
  
  // Feedback type
  feedback_type: z.enum(['automatic', 'user_explicit', 'system_inferred']),
  
  // Feedback content
  what_worked: z.array(z.string()).default([]),
  what_failed: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  
  // Scores
  component_appropriateness: z.number().min(1).max(5).optional(),
  layout_clarity: z.number().min(1).max(5).optional(),
  task_ease: z.number().min(1).max(5).optional(),
  
  // Metadata
  created_at: z.string().datetime(),
});

export type UIGenerationFeedback = z.infer<typeof UIGenerationFeedbackSchema>;

export const ComponentUsageStatsSchema = z.object({
  component_name: z.string(),
  
  // Usage counts
  total_uses: z.number().int(),
  successful_uses: z.number().int(),
  failed_uses: z.number().int(),
  
  // Performance
  average_generation_time_ms: z.number(),
  average_user_interaction_time_ms: z.number(),
  
  // Success metrics
  success_rate: z.number().min(0).max(1),
  user_satisfaction_avg: z.number().min(1).max(5).optional(),
  
  // Common patterns
  common_layouts: z.array(z.string()),
  common_prop_combinations: z.array(z.record(z.any())),
  
  // Issues
  common_errors: z.array(z.string()),
  improvement_suggestions: z.array(z.string()),
  
  // Metadata
  last_updated: z.string().datetime(),
});

export type ComponentUsageStats = z.infer<typeof ComponentUsageStatsSchema>;

export const LayoutEffectivenessSchema = z.object({
  layout_type: z.enum(['default', 'full_width', 'two_column', 'dashboard', 'single_column']),
  
  // Usage
  total_uses: z.number().int(),
  
  // Effectiveness
  task_completion_rate: z.number().min(0).max(1),
  average_time_to_completion_ms: z.number(),
  user_satisfaction_avg: z.number().min(1).max(5).optional(),
  
  // Best use cases
  best_for_data_types: z.array(z.string()),
  best_for_task_types: z.array(z.string()),
  
  // Metadata
  last_updated: z.string().datetime(),
});

export type LayoutEffectiveness = z.infer<typeof LayoutEffectivenessSchema>;
