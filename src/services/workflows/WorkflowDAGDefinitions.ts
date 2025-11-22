/**
 * Canonical Workflow DAG Definitions
 * 
 * Defines comprehensive workflow DAGs for all lifecycle stages:
 * Opportunity → Target → Realization → Expansion → Integrity
 * 
 * Features:
 * - Idempotent retry configurations
 * - Compensation logic for incomplete stages
 * - Circuit breaker integration
 * - Conditional transitions
 * - Parallel execution support
 * - Timeout protection
 */

import { logger } from '../../lib/logger';
import { WorkflowDAG, WorkflowStage, RetryConfig, LifecycleStage } from '../../types/workflow';

// ============================================================================
// Retry Configurations
// ============================================================================

export const RETRY_CONFIGS = {
  /**
   * Standard retry for most operations
   * 3 attempts with exponential backoff
   */
  STANDARD: {
    max_attempts: 3,
    initial_delay_ms: 500,
    max_delay_ms: 5000,
    multiplier: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * Aggressive retry for critical operations
   * 5 attempts with longer delays
   */
  AGGRESSIVE: {
    max_attempts: 5,
    initial_delay_ms: 1000,
    max_delay_ms: 10000,
    multiplier: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * Conservative retry for expensive operations
   * 2 attempts with minimal backoff
   */
  CONSERVATIVE: {
    max_attempts: 2,
    initial_delay_ms: 1000,
    max_delay_ms: 3000,
    multiplier: 1.5,
    jitter: false,
  } as RetryConfig,

  /**
   * No retry for idempotent operations
   */
  NONE: {
    max_attempts: 1,
    initial_delay_ms: 0,
    max_delay_ms: 0,
    multiplier: 1,
    jitter: false,
  } as RetryConfig,
};

// ============================================================================
// Stage Factory Functions
// ============================================================================

function createStage(
  id: string,
  name: string,
  agent_type: LifecycleStage,
  timeout_seconds: number,
  retry_config: RetryConfig = RETRY_CONFIGS.STANDARD,
  compensation_handler?: string,
  required_capabilities?: string[]
): WorkflowStage {
  return {
    id,
    name,
    agent_type,
    timeout_seconds,
    retry_config,
    compensation_handler,
    required_capabilities,
  };
}

// ============================================================================
// Opportunity Discovery Workflow
// ============================================================================

export const OPPORTUNITY_WORKFLOW: WorkflowDAG = {
  id: 'opportunity-discovery-v1',
  name: 'Opportunity Discovery Workflow',
  description: 'Identify and validate value opportunities through market analysis and stakeholder engagement',
  version: 1,
  stages: [
    createStage(
      'opportunity_research',
      'Market Research & Analysis',
      'opportunity',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateOpportunityResearch',
      ['market_analysis', 'competitive_intelligence']
    ),
    createStage(
      'opportunity_validation',
      'Opportunity Validation',
      'opportunity',
      60,
      RETRY_CONFIGS.STANDARD,
      'compensateOpportunityValidation',
      ['stakeholder_analysis', 'feasibility_check']
    ),
    createStage(
      'opportunity_prioritization',
      'Opportunity Prioritization',
      'opportunity',
      45,
      RETRY_CONFIGS.CONSERVATIVE,
      'compensateOpportunityPrioritization',
      ['scoring', 'ranking']
    ),
  ],
  transitions: [
    { from_stage: 'opportunity_research', to_stage: 'opportunity_validation' },
    { from_stage: 'opportunity_validation', to_stage: 'opportunity_prioritization' },
  ],
  initial_stage: 'opportunity_research',
  final_stages: ['opportunity_prioritization'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Target Value Commit Workflow
// ============================================================================

export const TARGET_WORKFLOW: WorkflowDAG = {
  id: 'target-value-commit-v1',
  name: 'Target Value Commit Workflow',
  description: 'Define KPI targets, commit to value delivery, and establish measurement frameworks',
  version: 1,
  stages: [
    createStage(
      'target_definition',
      'KPI Target Definition',
      'target',
      120,
      RETRY_CONFIGS.STANDARD,
      'compensateTargetDefinition',
      ['kpi_modeling', 'baseline_analysis']
    ),
    createStage(
      'target_validation',
      'Target Validation & Approval',
      'target',
      90,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateTargetValidation',
      ['stakeholder_approval', 'feasibility_check']
    ),
    createStage(
      'target_commitment',
      'Value Commitment',
      'target',
      60,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateTargetCommitment',
      ['contract_generation', 'sla_definition']
    ),
    createStage(
      'target_measurement_setup',
      'Measurement Framework Setup',
      'target',
      75,
      RETRY_CONFIGS.STANDARD,
      'compensateMeasurementSetup',
      ['metric_instrumentation', 'dashboard_creation']
    ),
  ],
  transitions: [
    { from_stage: 'target_definition', to_stage: 'target_validation' },
    { from_stage: 'target_validation', to_stage: 'target_commitment' },
    { from_stage: 'target_commitment', to_stage: 'target_measurement_setup' },
  ],
  initial_stage: 'target_definition',
  final_stages: ['target_measurement_setup'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Realization Tracking Workflow
// ============================================================================

export const REALIZATION_WORKFLOW: WorkflowDAG = {
  id: 'realization-tracking-v1',
  name: 'Realization Tracking Workflow',
  description: 'Monitor value delivery, track KPI progress, and manage variance',
  version: 1,
  stages: [
    createStage(
      'realization_data_collection',
      'Data Collection & Aggregation',
      'realization',
      120,
      RETRY_CONFIGS.STANDARD,
      'compensateDataCollection',
      ['data_ingestion', 'metric_calculation']
    ),
    createStage(
      'realization_analysis',
      'Performance Analysis',
      'realization',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateRealizationAnalysis',
      ['variance_analysis', 'trend_detection']
    ),
    createStage(
      'realization_reporting',
      'Stakeholder Reporting',
      'realization',
      60,
      RETRY_CONFIGS.CONSERVATIVE,
      'compensateRealizationReporting',
      ['report_generation', 'dashboard_update']
    ),
    createStage(
      'realization_intervention',
      'Intervention Planning',
      'realization',
      75,
      RETRY_CONFIGS.STANDARD,
      'compensateRealizationIntervention',
      ['risk_assessment', 'action_planning']
    ),
  ],
  transitions: [
    { from_stage: 'realization_data_collection', to_stage: 'realization_analysis' },
    { from_stage: 'realization_analysis', to_stage: 'realization_reporting' },
    { 
      from_stage: 'realization_reporting', 
      to_stage: 'realization_intervention',
      condition: 'variance_threshold_exceeded'
    },
  ],
  initial_stage: 'realization_data_collection',
  final_stages: ['realization_reporting', 'realization_intervention'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Expansion Modeling Workflow
// ============================================================================

export const EXPANSION_WORKFLOW: WorkflowDAG = {
  id: 'expansion-modeling-v1',
  name: 'Expansion Modeling Workflow',
  description: 'Identify expansion opportunities, model scenarios, and plan growth initiatives',
  version: 1,
  stages: [
    createStage(
      'expansion_opportunity_scan',
      'Expansion Opportunity Scanning',
      'expansion',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateExpansionScan',
      ['market_scanning', 'capability_assessment']
    ),
    createStage(
      'expansion_scenario_modeling',
      'Scenario Modeling & Analysis',
      'expansion',
      120,
      RETRY_CONFIGS.STANDARD,
      'compensateScenarioModeling',
      ['financial_modeling', 'risk_analysis']
    ),
    createStage(
      'expansion_business_case',
      'Business Case Development',
      'expansion',
      90,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateBusinessCase',
      ['roi_calculation', 'stakeholder_analysis']
    ),
    createStage(
      'expansion_roadmap',
      'Expansion Roadmap Planning',
      'expansion',
      75,
      RETRY_CONFIGS.STANDARD,
      'compensateExpansionRoadmap',
      ['timeline_planning', 'resource_allocation']
    ),
  ],
  transitions: [
    { from_stage: 'expansion_opportunity_scan', to_stage: 'expansion_scenario_modeling' },
    { from_stage: 'expansion_scenario_modeling', to_stage: 'expansion_business_case' },
    { from_stage: 'expansion_business_case', to_stage: 'expansion_roadmap' },
  ],
  initial_stage: 'expansion_opportunity_scan',
  final_stages: ['expansion_roadmap'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Integrity & Compliance Workflow
// ============================================================================

export const INTEGRITY_WORKFLOW: WorkflowDAG = {
  id: 'integrity-controls-v1',
  name: 'Integrity & Compliance Workflow',
  description: 'Validate data integrity, ensure compliance, and maintain audit trails',
  version: 1,
  stages: [
    createStage(
      'integrity_data_validation',
      'Data Integrity Validation',
      'integrity',
      90,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateDataValidation',
      ['data_quality_check', 'consistency_validation']
    ),
    createStage(
      'integrity_compliance_check',
      'Compliance Verification',
      'integrity',
      120,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateComplianceCheck',
      ['policy_validation', 'regulatory_check']
    ),
    createStage(
      'integrity_audit_trail',
      'Audit Trail Generation',
      'integrity',
      60,
      RETRY_CONFIGS.STANDARD,
      'compensateAuditTrail',
      ['log_generation', 'provenance_tracking']
    ),
    createStage(
      'integrity_certification',
      'Integrity Certification',
      'integrity',
      45,
      RETRY_CONFIGS.CONSERVATIVE,
      'compensateCertification',
      ['signature_generation', 'attestation']
    ),
  ],
  transitions: [
    { from_stage: 'integrity_data_validation', to_stage: 'integrity_compliance_check' },
    { from_stage: 'integrity_compliance_check', to_stage: 'integrity_audit_trail' },
    { from_stage: 'integrity_audit_trail', to_stage: 'integrity_certification' },
  ],
  initial_stage: 'integrity_data_validation',
  final_stages: ['integrity_certification'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Complete Lifecycle Workflow (End-to-End)
// ============================================================================

export const COMPLETE_LIFECYCLE_WORKFLOW: WorkflowDAG = {
  id: 'complete-value-lifecycle-v1',
  name: 'Complete Value Lifecycle Workflow',
  description: 'End-to-end value orchestration across all lifecycle stages',
  version: 1,
  stages: [
    // Opportunity Stage
    createStage(
      'opportunity_discovery',
      'Opportunity Discovery',
      'opportunity',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateOpportunityStage',
      ['market_analysis', 'opportunity_validation']
    ),
    
    // Target Stage
    createStage(
      'target_value_commit',
      'Value Commit & KPI Targets',
      'target',
      120,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateTargetStage',
      ['kpi_modeling', 'target_validation', 'commitment']
    ),
    
    // Realization Stage
    createStage(
      'realization_tracking',
      'Realization Tracking',
      'realization',
      120,
      RETRY_CONFIGS.STANDARD,
      'compensateRealizationStage',
      ['data_collection', 'performance_analysis', 'reporting']
    ),
    
    // Expansion Stage
    createStage(
      'expansion_modeling',
      'Expansion Modeling',
      'expansion',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateExpansionStage',
      ['opportunity_scan', 'scenario_modeling', 'business_case']
    ),
    
    // Integrity Stage
    createStage(
      'integrity_controls',
      'Integrity & Compliance Controls',
      'integrity',
      90,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateIntegrityStage',
      ['data_validation', 'compliance_check', 'audit_trail']
    ),
  ],
  transitions: [
    { from_stage: 'opportunity_discovery', to_stage: 'target_value_commit' },
    { from_stage: 'target_value_commit', to_stage: 'realization_tracking' },
    { from_stage: 'realization_tracking', to_stage: 'expansion_modeling' },
    { from_stage: 'expansion_modeling', to_stage: 'integrity_controls' },
  ],
  initial_stage: 'opportunity_discovery',
  final_stages: ['integrity_controls'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Parallel Execution Workflow (Advanced)
// ============================================================================

export const PARALLEL_LIFECYCLE_WORKFLOW: WorkflowDAG = {
  id: 'parallel-value-lifecycle-v1',
  name: 'Parallel Value Lifecycle Workflow',
  description: 'Optimized workflow with parallel execution for independent stages',
  version: 1,
  stages: [
    // Initial opportunity discovery
    createStage(
      'opportunity_discovery',
      'Opportunity Discovery',
      'opportunity',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateOpportunityStage'
    ),
    
    // Parallel: Target definition and integrity setup
    createStage(
      'target_definition_parallel',
      'Target Definition (Parallel)',
      'target',
      120,
      RETRY_CONFIGS.AGGRESSIVE,
      'compensateTargetStage'
    ),
    createStage(
      'integrity_setup_parallel',
      'Integrity Setup (Parallel)',
      'integrity',
      60,
      RETRY_CONFIGS.STANDARD,
      'compensateIntegritySetup'
    ),
    
    // Convergence: Realization tracking
    createStage(
      'realization_tracking',
      'Realization Tracking',
      'realization',
      120,
      RETRY_CONFIGS.STANDARD,
      'compensateRealizationStage'
    ),
    
    // Final: Expansion
    createStage(
      'expansion_modeling',
      'Expansion Modeling',
      'expansion',
      90,
      RETRY_CONFIGS.STANDARD,
      'compensateExpansionStage'
    ),
  ],
  transitions: [
    // Fork: Opportunity → Target & Integrity (parallel)
    { from_stage: 'opportunity_discovery', to_stage: 'target_definition_parallel' },
    { from_stage: 'opportunity_discovery', to_stage: 'integrity_setup_parallel' },
    
    // Join: Target & Integrity → Realization
    { from_stage: 'target_definition_parallel', to_stage: 'realization_tracking' },
    { from_stage: 'integrity_setup_parallel', to_stage: 'realization_tracking' },
    
    // Linear: Realization → Expansion
    { from_stage: 'realization_tracking', to_stage: 'expansion_modeling' },
  ],
  initial_stage: 'opportunity_discovery',
  final_stages: ['expansion_modeling'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Workflow Registry
// ============================================================================

export const WORKFLOW_REGISTRY = {
  OPPORTUNITY: OPPORTUNITY_WORKFLOW,
  TARGET: TARGET_WORKFLOW,
  REALIZATION: REALIZATION_WORKFLOW,
  EXPANSION: EXPANSION_WORKFLOW,
  INTEGRITY: INTEGRITY_WORKFLOW,
  COMPLETE_LIFECYCLE: COMPLETE_LIFECYCLE_WORKFLOW,
  PARALLEL_LIFECYCLE: PARALLEL_LIFECYCLE_WORKFLOW,
} as const;

export const ALL_WORKFLOW_DEFINITIONS = Object.values(WORKFLOW_REGISTRY);

// ============================================================================
// Workflow Lookup Functions
// ============================================================================

export function getWorkflowById(id: string): WorkflowDAG | undefined {
  return ALL_WORKFLOW_DEFINITIONS.find(workflow => workflow.id === id);
}

export function getWorkflowByName(name: string): WorkflowDAG | undefined {
  return ALL_WORKFLOW_DEFINITIONS.find(workflow => workflow.name === name);
}

export function getWorkflowsByStage(stage: LifecycleStage): WorkflowDAG[] {
  return ALL_WORKFLOW_DEFINITIONS.filter(workflow =>
    workflow.stages.some(s => s.agent_type === stage)
  );
}

export function getStageById(workflowId: string, stageId: string): WorkflowStage | undefined {
  const workflow = getWorkflowById(workflowId);
  return workflow?.stages.find(stage => stage.id === stageId);
}

// ============================================================================
// Workflow Validation
// ============================================================================

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateWorkflowDAG(workflow: WorkflowDAG): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check initial stage exists
  if (!workflow.stages.find(s => s.id === workflow.initial_stage)) {
    errors.push(`Initial stage '${workflow.initial_stage}' not found in stages`);
  }

  // Check final stages exist
  workflow.final_stages.forEach(finalStage => {
    if (!workflow.stages.find(s => s.id === finalStage)) {
      errors.push(`Final stage '${finalStage}' not found in stages`);
    }
  });

  // Check transitions reference valid stages
  workflow.transitions.forEach(transition => {
    if (!workflow.stages.find(s => s.id === transition.from_stage)) {
      errors.push(`Transition from_stage '${transition.from_stage}' not found`);
    }
    if (!workflow.stages.find(s => s.id === transition.to_stage)) {
      errors.push(`Transition to_stage '${transition.to_stage}' not found`);
    }
  });

  // Check for unreachable stages
  const reachableStages = new Set<string>([workflow.initial_stage]);
  let changed = true;
  while (changed) {
    changed = false;
    workflow.transitions.forEach(transition => {
      if (reachableStages.has(transition.from_stage) && !reachableStages.has(transition.to_stage)) {
        reachableStages.add(transition.to_stage);
        changed = true;
      }
    });
  }

  workflow.stages.forEach(stage => {
    if (!reachableStages.has(stage.id)) {
      warnings.push(`Stage '${stage.id}' is unreachable from initial stage`);
    }
  });

  // Check for cycles (warning, not error - cycles can be intentional)
  const hasCycle = detectCycle(workflow);
  if (hasCycle) {
    warnings.push('Workflow contains cycles - ensure this is intentional');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function detectCycle(workflow: WorkflowDAG): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(stageId: string): boolean {
    visited.add(stageId);
    recursionStack.add(stageId);

    const outgoingTransitions = workflow.transitions.filter(t => t.from_stage === stageId);
    for (const transition of outgoingTransitions) {
      if (!visited.has(transition.to_stage)) {
        if (dfs(transition.to_stage)) {
          return true;
        }
      } else if (recursionStack.has(transition.to_stage)) {
        return true;
      }
    }

    recursionStack.delete(stageId);
    return false;
  }

  return dfs(workflow.initial_stage);
}

// ============================================================================
// Export All
// ============================================================================

export {
  OPPORTUNITY_WORKFLOW,
  TARGET_WORKFLOW,
  REALIZATION_WORKFLOW,
  EXPANSION_WORKFLOW,
  INTEGRITY_WORKFLOW,
  COMPLETE_LIFECYCLE_WORKFLOW,
  PARALLEL_LIFECYCLE_WORKFLOW,
};
