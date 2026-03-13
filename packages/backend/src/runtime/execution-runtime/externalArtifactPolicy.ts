import type { AgentType } from '../../services/agent-types.js';
import type { WorkflowStage } from '../../types/workflow.js';

const EXTERNAL_ARTIFACT_AGENT_TYPES: ReadonlySet<AgentType> = new Set([
  'narrative',
  'communicator',
  'realization',
  'expansion',
]);

const EXTERNAL_ARTIFACT_STAGE_KEYWORDS = [
  'external',
  'artifact',
  'proposal',
  'presentation',
  'deck',
  'report',
  'narrative',
  'publish',
  'customer',
  'export',
] as const;

function hasExternalKeyword(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return EXTERNAL_ARTIFACT_STAGE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function isExternalArtifactActionForAgent(agentType: AgentType, currentStage?: string): boolean {
  if (EXTERNAL_ARTIFACT_AGENT_TYPES.has(agentType)) {
    return true;
  }

  return hasExternalKeyword(currentStage);
}

export function isExternalArtifactActionForStage(stage: WorkflowStage): boolean {
  const stageRecord = stage as unknown as Record<string, unknown>;
  const metadata = stageRecord.metadata;

  if (metadata && typeof metadata === 'object' && 'is_external_artifact_action' in metadata) {
    const flag = (metadata as Record<string, unknown>).is_external_artifact_action;
    if (typeof flag === 'boolean') {
      return flag;
    }
  }

  if (EXTERNAL_ARTIFACT_AGENT_TYPES.has(stage.agent_type as AgentType)) {
    return true;
  }

  return [stage.id, stage.name, stage.description].some((value) => hasExternalKeyword(value));
}

export function extractOpportunityConfidence(source: Record<string, unknown> | undefined): number | undefined {
  if (!source) {
    return undefined;
  }

  const directConfidence = source.confidence_score;
  if (typeof directConfidence === 'number') {
    return directConfidence;
  }

  const opportunity = source.opportunity;
  if (opportunity && typeof opportunity === 'object') {
    const nestedConfidence = (opportunity as Record<string, unknown>).confidence_score;
    if (typeof nestedConfidence === 'number') {
      return nestedConfidence;
    }
  }

  return undefined;
}
