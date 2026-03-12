import type { AgentType } from '../../services/agent-types.js';
import type { WorkflowStage } from '../../types/workflow.js';

const EXTERNAL_ACTION_KEYWORDS = [
  'business_case',
  'businesscase',
  'narrative',
  'proposal',
  'deck',
  'customer',
  'report',
  'artifact',
  'publish',
  'presentation',
] as const;

const EXTERNAL_LIFECYCLE_STAGES = new Set<string>([
  'composing',
  'realized',
  'expansion',
]);

const EXTERNAL_AGENT_TYPES = new Set<AgentType>([
  'narrative',
  'financial-modeling',
  'realization',
  'expansion',
]);

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hasExternalKeyword(value: string | undefined): boolean {
  const normalized = normalize(value);
  return EXTERNAL_ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function isExternalArtifactAgentAction(agentType: AgentType, actionOrQuery?: string): boolean {
  if (EXTERNAL_AGENT_TYPES.has(agentType)) {
    return true;
  }

  return hasExternalKeyword(actionOrQuery);
}

export function isExternalArtifactWorkflowStage(stage: WorkflowStage): boolean {
  const lifecycle = normalize(stage.agent_type);
  if (EXTERNAL_LIFECYCLE_STAGES.has(lifecycle)) {
    return true;
  }

  return hasExternalKeyword(stage.id) || hasExternalKeyword(stage.name) || hasExternalKeyword(stage.description);
}
