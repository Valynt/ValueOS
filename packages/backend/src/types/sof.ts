/**
 * SOF (Service Orchestration Framework) Types
 */

export interface SOFService {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface SOFOrchestration {
  id: string;
  services: SOFService[];
  execution_plan: ExecutionStep[];
}

export interface ExecutionStep {
  service_id: string;
  operation: string;
  inputs: Record<string, unknown>;
  outputs: string[];
}

export interface OutcomeHypothesis {
  id: string;
  description: string;
  probability: number;
  impact: number;
  evidence?: string[];
}

// typed-debt-boundary-migration: sof.ts migrated orchestration config/input bags from any→unknown; owner=@orchestration, remaining debt=define typed service config/input contracts per SOF service kind.
