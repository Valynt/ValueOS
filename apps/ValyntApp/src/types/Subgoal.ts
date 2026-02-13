/**
 * Subgoal Types
 */

export interface Subgoal {
  id: string;
  parent_goal_id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dependencies: string[];
  created_at: string;
}
