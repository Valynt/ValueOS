export interface Agent {
  id: string;
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'maintenance';
  config: Record<string, any>;
}

export interface AgentSession {
  id: string;
  user_id: string;
  session_token: string;
  context: Record<string, any>;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  started_at: Date;
  ended_at?: Date;
  metadata: Record<string, any>;
}

export type MemoryType = 'episodic' | 'semantic' | 'working' | 'procedural';

export interface AgentMemory {
  id: string;
  session_id: string;
  agent_id: string;
  memory_type: MemoryType;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  importance_score: number;
  created_at: Date;
  accessed_at: Date;
}

export type MessageType = 'task_assignment' | 'task_result' | 'status_event' | 'audit_event';

export interface Message {
  id: string;
  session_id: string;
  from_agent_id?: string;
  to_agent_id?: string;
  message_type: MessageType;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  created_at: Date;
  processed_at?: Date;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  dag_definition: DAGDefinition;
  version: number;
  is_active: boolean;
}

export interface DAGDefinition {
  nodes: DAGNode[];
  quality_check: QualityCheck;
}

export interface DAGNode {
  id: string;
  agent?: string;
  type?: 'parallel';
  dependencies: string[];
  branches?: DAGNode[];
  description: string;
}

export interface QualityCheck {
  agent: string;
  rubric: QualityRubric;
  threshold: number;
  max_iterations: number;
}

export interface QualityRubric {
  traceability: number;
  relevance: number;
  realism: number;
  clarity: number;
  actionability: number;
  polish: number;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  session_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step?: string;
  dag_state: Record<string, any>;
  error_message?: string;
  quality_score?: number;
  iteration_count: number;
  started_at: Date;
  completed_at?: Date;
  metadata: Record<string, any>;
}

export interface Task {
  id: string;
  workflow_execution_id: string;
  agent_id: string;
  task_type: string;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'retry';
  priority: number;
  retry_count: number;
  max_retries: number;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  metadata: Record<string, any>;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AuditLog {
  id: string;
  session_id: string;
  agent_id: string;
  action: string;
  reasoning?: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  confidence_level?: ConfidenceLevel;
  evidence: any[];
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ValueCase {
  id: string;
  session_id: string;
  name: string;
  description?: string;
  company_profile_id?: string;
  status: 'draft' | 'review' | 'published';
  lifecycle_stage?: 'opportunity' | 'target' | 'realization' | 'expansion';
  quality_score?: number;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export interface CompanyProfile {
  id: string;
  value_case_id: string;
  company_name: string;
  industry?: string;
  vertical?: string;
  company_size?: string;
  buyer_persona?: Record<string, any>;
  pain_points: any[];
  current_state?: Record<string, any>;
  confidence_level?: ConfidenceLevel;
  created_at: Date;
  updated_at: Date;
}

export interface ValueMap {
  id: string;
  value_case_id: string;
  feature: string;
  capability: string;
  business_outcome: string;
  value_driver: string;
  confidence_level?: ConfidenceLevel;
  supporting_evidence: any[];
  created_at: Date;
}

export interface KPIHypothesis {
  id: string;
  value_case_id: string;
  kpi_name: string;
  baseline_value?: number;
  target_value?: number;
  unit?: string;
  timeframe?: string;
  calculation_method?: string;
  confidence_level?: ConfidenceLevel;
  assumptions: any[];
  created_at: Date;
}

export interface FinancialModel {
  id: string;
  value_case_id: string;
  roi_percentage?: number;
  npv_amount?: number;
  payback_months?: number;
  total_investment?: number;
  total_benefit?: number;
  cost_breakdown?: Record<string, any>;
  benefit_breakdown?: Record<string, any>;
  sensitivity_analysis?: Record<string, any>;
  confidence_level?: ConfidenceLevel;
  created_at: Date;
  updated_at: Date;
}

export interface Assumption {
  id: string;
  value_case_id: string;
  related_table: string;
  related_id: string;
  assumption_type: string;
  assumption_text: string;
  source?: string;
  confidence_level?: ConfidenceLevel;
  validation_status: 'pending' | 'validated' | 'rejected' | 'needs_review';
  evidence: any[];
  created_at: Date;
}

export interface AgentFabricResult {
  value_case_id: string;
  company_profile: CompanyProfile;
  value_maps: ValueMap[];
  kpi_hypotheses: KPIHypothesis[];
  financial_model: FinancialModel;
  assumptions: Assumption[];
  quality_score: number;
  execution_metadata: {
    execution_id: string;
    iteration_count: number;
    total_tokens: number;
    total_latency_ms: number;
    agent_contributions: Record<string, any>;
  };
}
