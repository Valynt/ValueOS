import type { AgentType } from '../agent-types.js';

export const INTERACTIVE_SYNC_AGENT_ALLOWLIST = [
  'opportunity',
  'target',
  'integrity',
  'expansion',
  'realization',
  'financial-modeling',
] as const satisfies readonly AgentType[];

export const ASYNC_WARM_AGENT_TYPES = [
  'research',
] as const satisfies readonly AgentType[];

export const SCALE_TO_ZERO_ASYNC_ONLY_AGENT_DENYLIST = [
  'company-intelligence',
  'value-mapping',
  'system-mapper',
  'intervention-designer',
  'outcome-engineer',
  'coordinator',
  'value-eval',
  'communicator',
  'benchmark',
  'narrative',
  'groundtruth',
] as const satisfies readonly AgentType[];

export type InteractiveInvocationMode =
  | 'interactive-sync'
  | 'queued-async'
  | 'polling-async'
  | 'streaming-async'
  | 'background-orchestration';

export type AgentColdStartClass =
  | 'interactive-warm'
  | 'async-warm'
  | 'async-scale-to-zero';

export interface AgentCapacityPolicy {
  agent: AgentType;
  coldStartClass: AgentColdStartClass;
  interactiveSyncAllowed: boolean;
  requiresWarmCapacity: boolean;
  invocationContract: 'interactive-sync' | 'async-only';
}

const INTERACTIVE_SYNC_AGENT_SET = new Set<AgentType>(INTERACTIVE_SYNC_AGENT_ALLOWLIST);
const ASYNC_WARM_AGENT_SET = new Set<AgentType>(ASYNC_WARM_AGENT_TYPES);
const SCALE_TO_ZERO_AGENT_SET = new Set<AgentType>(SCALE_TO_ZERO_ASYNC_ONLY_AGENT_DENYLIST);

const AGENT_CAPACITY_POLICIES: Record<AgentType, AgentCapacityPolicy> = {
  opportunity: {
    agent: 'opportunity',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  target: {
    agent: 'target',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  integrity: {
    agent: 'integrity',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  expansion: {
    agent: 'expansion',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  realization: {
    agent: 'realization',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  'financial-modeling': {
    agent: 'financial-modeling',
    coldStartClass: 'interactive-warm',
    interactiveSyncAllowed: true,
    requiresWarmCapacity: true,
    invocationContract: 'interactive-sync',
  },
  research: {
    agent: 'research',
    coldStartClass: 'async-warm',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'company-intelligence': {
    agent: 'company-intelligence',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'value-mapping': {
    agent: 'value-mapping',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'system-mapper': {
    agent: 'system-mapper',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'intervention-designer': {
    agent: 'intervention-designer',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'outcome-engineer': {
    agent: 'outcome-engineer',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  coordinator: {
    agent: 'coordinator',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'value-eval': {
    agent: 'value-eval',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  communicator: {
    agent: 'communicator',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  benchmark: {
    agent: 'benchmark',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  narrative: {
    agent: 'narrative',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  groundtruth: {
    agent: 'groundtruth',
    coldStartClass: 'async-scale-to-zero',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
  'compliance-auditor': {
    agent: 'compliance-auditor',
    coldStartClass: 'async-warm',
    interactiveSyncAllowed: false,
    requiresWarmCapacity: false,
    invocationContract: 'async-only',
  },
};

export function getAgentCapacityPolicy(agent: AgentType): AgentCapacityPolicy {
  return AGENT_CAPACITY_POLICIES[agent];
}

export function getAgentColdStartClass(agent: AgentType): AgentColdStartClass {
  return getAgentCapacityPolicy(agent).coldStartClass;
}

export function isInteractiveSyncAgentAllowed(agent: AgentType): boolean {
  return INTERACTIVE_SYNC_AGENT_SET.has(agent);
}

export function isAsyncWarmAgent(agent: AgentType): boolean {
  return ASYNC_WARM_AGENT_SET.has(agent);
}

export function isScaleToZeroAsyncOnlyAgent(agent: AgentType): boolean {
  return SCALE_TO_ZERO_AGENT_SET.has(agent);
}

export function requiresWarmCapacity(agent: AgentType): boolean {
  return getAgentCapacityPolicy(agent).requiresWarmCapacity;
}

export function buildInteractiveSyncDeniedMessage(agent: AgentType, caller: string): string {
  const policy = getAgentCapacityPolicy(agent);
  return `${agent} is classified as ${policy.coldStartClass} and must not run on synchronous request path ${caller}. Use queue, polling, or streaming workflows instead.`;
}

export function assertInteractiveSyncAgentAllowed(agent: AgentType, caller: string): void {
  if (!isInteractiveSyncAgentAllowed(agent)) {
    throw new Error(buildInteractiveSyncDeniedMessage(agent, caller));
  }
}

export function isDirectSyncFallbackAllowedWithoutKafka(agent: AgentType): boolean {
  if (isInteractiveSyncAgentAllowed(agent)) {
    return true;
  }
  const nonProduction = (process.env.NODE_ENV ?? "development") !== "production";
  return nonProduction && (agent === "narrative" || agent === "groundtruth");
}

export function isInteractiveInvocationMode(mode: InteractiveInvocationMode | undefined): boolean {
  return (mode ?? 'interactive-sync') === 'interactive-sync';
}
