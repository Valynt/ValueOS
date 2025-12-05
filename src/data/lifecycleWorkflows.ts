import { LifecycleStage, WorkflowDAG } from '../types/workflow';

const baseRetryConfig = {
  max_attempts: 3,
  initial_delay_ms: 500,
  max_delay_ms: 5000,
  multiplier: 2,
  jitter: true
};

const createStage = (
  id: string,
  name: string,
  agent_type: LifecycleStage,
  timeout_seconds: number,
  compensation_handler?: string
) => ({
  id,
  name,
  agent_type,
  timeout_seconds,
  retry_config: baseRetryConfig,
  compensation_handler
});

export const LIFECYCLE_WORKFLOW_DEFINITIONS: WorkflowDAG[] = [
  {
    id: 'value-lifecycle-v1',
    name: 'Value Lifecycle Workflow',
    description: 'End-to-end Value Orchestration across lifecycle stages',
    version: 1,
    stages: [
      createStage('opportunity_discovery', 'Opportunity Discovery', 'opportunity', 90, 'compensateOpportunityStage'),
      createStage('target_value_commit', 'Value Commit & KPI Targets', 'target', 120, 'compensateTargetStage'),
      createStage('realization_tracking', 'Realization Tracking', 'realization', 120, 'compensateRealizationStage'),
      createStage('expansion_modeling', 'Expansion Modeling', 'expansion', 90, 'compensateExpansionStage'),
      createStage('integrity_controls', 'Integrity & Compliance Controls', 'integrity', 90, 'compensateIntegrityStage')
    ],
    transitions: [
      { from_stage: 'opportunity_discovery', to_stage: 'target_value_commit' },
      { from_stage: 'target_value_commit', to_stage: 'realization_tracking' },
      { from_stage: 'realization_tracking', to_stage: 'expansion_modeling' },
      { from_stage: 'expansion_modeling', to_stage: 'integrity_controls' }
    ],
    initial_stage: 'opportunity_discovery',
    final_stages: ['integrity_controls'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export function getLifecycleWorkflowByVersion(version: number): WorkflowDAG | undefined {
  return LIFECYCLE_WORKFLOW_DEFINITIONS.find(def => def.version === version);
}
