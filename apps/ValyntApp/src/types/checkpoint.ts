/**
 * CheckpointStatus — Type definition for realization checkpoints
 *
 * Phase 5.3: Realization Tracker
 */

export type CheckpointStatus = "pending" | "completed" | "missed" | "at_risk";

export interface Checkpoint {
  id: string;
  name: string;
  dueDate: string;
  actualValue: number | null;
  targetValue: number;
  status: CheckpointStatus;
  notes?: string;
}
