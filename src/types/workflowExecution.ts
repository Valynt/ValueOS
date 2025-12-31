import { LifecycleStage, StageStatus } from './workflow';

export interface ExecutionIntent {
  description: string;
  objective?: string;
  successCriteria?: string[];
  hypothesis?: string;
}

export interface ExecutionEntryPoint {
  trigger: string;
  requestedBy: string;
  sessionId?: string;
  channel?: string;
}

export interface ExecutionIOEnvelope {
  inputs: Record<string, any>;
  assumptions: string[];
  outputs: Record<string, any>;
}

export interface EconomicDelta {
  metric: string;
  baseline?: number;
  target?: number;
  delta?: number;
  unit?: string;
  confidence?: number;
  narrative?: string;
}

export interface AuditEnvelope {
  traceId: string;
  userId: string;
  createdAt: string;
  approvals?: string[];
  complianceTags?: string[];
  notes?: string;
}

export interface StageLifecycleRecord {
  stageId: string;
  lifecycleStage: LifecycleStage;
  status: StageStatus;
  startedAt: string;
  completedAt?: string;
  summary?: string;
}

export interface ExecutionOutputRecord {
  stageId: string;
  payload: Record<string, any>;
  completedAt: string;
}

export interface WorkflowExecutionRecord {
  id?: string;
  workflowDefinitionId: string;
  workflowVersion: number;
  persona?: string;
  industry?: string;
  fiscalQuarter?: string;
  intent: ExecutionIntent;
  entryPoint: ExecutionEntryPoint;
  lifecycle: StageLifecycleRecord[];
  io: ExecutionIOEnvelope;
  economicDeltas: EconomicDelta[];
  auditEnvelope: AuditEnvelope;
  outputs: ExecutionOutputRecord[];
}
