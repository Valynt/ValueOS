/**
 * SOF (Service Orchestration Framework) Types
 */

export interface SOFService {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
}

export interface SOFOrchestration {
  id: string;
  services: SOFService[];
  execution_plan: ExecutionStep[];
}

export interface ExecutionStep {
  service_id: string;
  operation: string;
  inputs: Record<string, any>;
  outputs: string[];
}
