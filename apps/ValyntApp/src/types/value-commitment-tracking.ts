import { z } from "zod";
import {
  ValueCommitmentSchema,
  CommitmentStakeholderSchema,
  CommitmentMilestoneSchema,
  CommitmentMetricSchema,
  CommitmentRiskSchema,
  CommitmentAuditSchema,
} from "./value-commitment-schemas";

export type ValueCommitment = z.infer<typeof ValueCommitmentSchema> & { id: string };
export type ValueCommitmentInsert = z.input<typeof ValueCommitmentSchema>;

export type CommitmentStakeholder = z.infer<typeof CommitmentStakeholderSchema>;
export type CommitmentStakeholderInsert = z.input<typeof CommitmentStakeholderSchema>;

export type CommitmentMilestone = z.infer<typeof CommitmentMilestoneSchema>;
export type CommitmentMilestoneInsert = z.input<typeof CommitmentMilestoneSchema>;

export type CommitmentMetric = z.infer<typeof CommitmentMetricSchema>;
export type CommitmentMetricInsert = z.input<typeof CommitmentMetricSchema>;

export type CommitmentRisk = z.infer<typeof CommitmentRiskSchema>;
export type CommitmentRiskInsert = z.input<typeof CommitmentRiskSchema>;

export type CommitmentAudit = z.infer<typeof CommitmentAuditSchema>;
export type CommitmentAuditInsert = z.input<typeof CommitmentAuditSchema>;

export interface CommitmentProgress {
  commitment_id: string;
  overall_progress: number;
  milestone_completion: number;
  metric_achievement: number;
  risk_level: string;
  days_remaining: number;
  is_on_track: boolean;
}

export interface CommitmentDashboard {
  commitment: ValueCommitment;
  stakeholders: CommitmentStakeholder[];
  milestones: CommitmentMilestone[];
  metrics: CommitmentMetric[];
  risks: CommitmentRisk[];
  progress: CommitmentProgress;
  recent_audits: CommitmentAudit[];
}
