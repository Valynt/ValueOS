/**
 * Subgoal Types for CoordinatorAgent
 * 
 * Defines subgoals that the coordinator breaks tasks into.
 */

import { z } from 'zod';

export const SubgoalStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'blocked',
]);

export type SubgoalStatus = z.infer<typeof SubgoalStatusSchema>;

export const SubgoalTypeSchema = z.enum([
  'discovery',
  'analysis',
  'design',
  'validation',
  'execution',
  'monitoring',
  'reporting',
]);

export type SubgoalType = z.infer<typeof SubgoalTypeSchema>;

export const SubgoalSchema = z.object({
  id: z.string().uuid(),
  parent_task_id: z.string().uuid(),
  subgoal_type: SubgoalTypeSchema,
  description: z.string(),
  assigned_agent: z.string(),
  dependencies: z.array(z.string().uuid()).default([]),
  status: SubgoalStatusSchema.default('pending'),
  priority: z.number().int().min(1).max(10).default(5),
  estimated_complexity: z.number().min(0).max(1),
  context: z.record(z.any()).default({}),
  output: z.record(z.any()).optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
});

export type Subgoal = z.infer<typeof SubgoalSchema>;

export const CreateSubgoalSchema = SubgoalSchema.omit({
  id: true,
  created_at: true,
  started_at: true,
  completed_at: true,
}).partial({
  status: true,
  priority: true,
  estimated_complexity: true,
  context: true,
  dependencies: true,
});

export type CreateSubgoal = z.infer<typeof CreateSubgoalSchema>;

export const TaskIntentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  business_case_id: z.string().uuid().optional(),
  intent_description: z.string(),
  intent_type: z.enum([
    'create_business_case',
    'analyze_opportunity',
    'design_intervention',
    'monitor_realization',
    'generate_report',
    'update_artifact',
    'query_data',
  ]),
  context: z.record(z.any()).default({}),
  constraints: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
});

export type TaskIntent = z.infer<typeof TaskIntentSchema>;

export const CreateTaskIntentSchema = TaskIntentSchema.omit({
  id: true,
  created_at: true,
}).partial({
  business_case_id: true,
  context: true,
  constraints: true,
});

export type CreateTaskIntent = z.infer<typeof CreateTaskIntentSchema>;

export const SubgoalRoutingSchema = z.object({
  subgoal_id: z.string().uuid(),
  agent_name: z.string(),
  routing_reason: z.string(),
  confidence: z.number().min(0).max(1),
  alternative_agents: z.array(z.string()).default([]),
});

export type SubgoalRouting = z.infer<typeof SubgoalRoutingSchema>;

export const TaskPlanSchema = z.object({
  task_id: z.string().uuid(),
  subgoals: z.array(SubgoalSchema),
  execution_order: z.array(z.string().uuid()),
  estimated_duration: z.number().optional(),
  complexity_score: z.number().min(0).max(1),
  requires_simulation: z.boolean().default(false),
});

export type TaskPlan = z.infer<typeof TaskPlanSchema>;
