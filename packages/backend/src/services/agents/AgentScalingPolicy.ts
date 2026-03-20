import type { AgentType } from './agent-types.js';

export type AgentColdStartClass =
  | 'warm-interactive'
  | 'warm-async'
  | 'scale-to-zero-async';

export type RequestPathPolicy = 'interactive-allowlisted' | 'async-only' | 'async-preferred';

export interface AgentScalingDescriptor {
  agent: AgentType;
  kubernetesName: string;
  coldStartClass: AgentColdStartClass;
  requestPathPolicy: RequestPathPolicy;
  minWarmReplicas: number;
}

export const INTERACTIVE_AGENT_ALLOWLIST = [
  'opportunity',
  'target',
  'integrity',
  'expansion',
  'realization',
  'financial-modeling',
] as const satisfies readonly AgentType[];

export const SCALE_TO_ZERO_AGENT_DENYLIST = [
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

export const ASYNC_WARM_AGENT_SET = [
  'research',
] as const satisfies readonly AgentType[];

const interactiveSet = new Set<AgentType>(INTERACTIVE_AGENT_ALLOWLIST);
const scaleToZeroSet = new Set<AgentType>(SCALE_TO_ZERO_AGENT_DENYLIST);
const asyncWarmSet = new Set<AgentType>(ASYNC_WARM_AGENT_SET);

export const AGENT_SCALING_POLICY: Record<AgentType, AgentScalingDescriptor> = {
  opportunity: {
    agent: 'opportunity',
    kubernetesName: 'opportunity-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 2,
  },
  target: {
    agent: 'target',
    kubernetesName: 'target-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 2,
  },
  integrity: {
    agent: 'integrity',
    kubernetesName: 'integrity-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 2,
  },
  expansion: {
    agent: 'expansion',
    kubernetesName: 'expansion-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 3,
  },
  realization: {
    agent: 'realization',
    kubernetesName: 'realization-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 2,
  },
  'financial-modeling': {
    agent: 'financial-modeling',
    kubernetesName: 'financial-modeling-agent',
    coldStartClass: 'warm-interactive',
    requestPathPolicy: 'interactive-allowlisted',
    minWarmReplicas: 3,
  },
  research: {
    agent: 'research',
    kubernetesName: 'research-agent',
    coldStartClass: 'warm-async',
    requestPathPolicy: 'async-preferred',
    minWarmReplicas: 3,
  },
  'company-intelligence': {
    agent: 'company-intelligence',
    kubernetesName: 'company-intelligence-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'value-mapping': {
    agent: 'value-mapping',
    kubernetesName: 'value-mapping-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'system-mapper': {
    agent: 'system-mapper',
    kubernetesName: 'system-mapper-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'intervention-designer': {
    agent: 'intervention-designer',
    kubernetesName: 'intervention-designer-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'outcome-engineer': {
    agent: 'outcome-engineer',
    kubernetesName: 'outcome-engineer-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  coordinator: {
    agent: 'coordinator',
    kubernetesName: 'coordinator-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'value-eval': {
    agent: 'value-eval',
    kubernetesName: 'value-eval-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  communicator: {
    agent: 'communicator',
    kubernetesName: 'communicator-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  benchmark: {
    agent: 'benchmark',
    kubernetesName: 'benchmark-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  narrative: {
    agent: 'narrative',
    kubernetesName: 'narrative-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  groundtruth: {
    agent: 'groundtruth',
    kubernetesName: 'groundtruth-agent',
    coldStartClass: 'scale-to-zero-async',
    requestPathPolicy: 'async-only',
    minWarmReplicas: 0,
  },
  'compliance-auditor': {
    agent: 'compliance-auditor',
    kubernetesName: 'compliance-auditor-agent',
    coldStartClass: 'warm-async',
    requestPathPolicy: 'async-preferred',
    minWarmReplicas: 1,
  },
};

export function getAgentScalingDescriptor(agent: AgentType): AgentScalingDescriptor {
  return AGENT_SCALING_POLICY[agent];
}

export function getAgentColdStartClass(agent: AgentType): AgentColdStartClass {
  return getAgentScalingDescriptor(agent).coldStartClass;
}

export function getRequestPathPolicy(agent: AgentType): RequestPathPolicy {
  return getAgentScalingDescriptor(agent).requestPathPolicy;
}

export function isInteractiveAgentAllowed(agent: AgentType): boolean {
  return interactiveSet.has(agent);
}

export function isScaleToZeroAgent(agent: AgentType): boolean {
  return scaleToZeroSet.has(agent);
}

export function isAsyncWarmAgent(agent: AgentType): boolean {
  return asyncWarmSet.has(agent);
}

export class InteractiveAgentPolicyError extends Error {
  readonly agent: AgentType;
  readonly requestPathPolicy: RequestPathPolicy;

  constructor(agent: AgentType, entryPoint?: string) {
    const descriptor = getAgentScalingDescriptor(agent);
    const prefix = entryPoint ? `${entryPoint}: ` : '';
    super(
      `${prefix}${descriptor.kubernetesName} is classified as ${descriptor.coldStartClass} and ${descriptor.requestPathPolicy}. ` +
      'Scale-to-zero and async-only agents must be invoked via queue, polling, or streaming workflows instead of synchronous request paths.',
    );
    this.name = 'InteractiveAgentPolicyError';
    this.agent = agent;
    this.requestPathPolicy = descriptor.requestPathPolicy;
  }
}

export function assertInteractiveAgentAllowed(agent: AgentType, entryPoint?: string): void {
  if (!isInteractiveAgentAllowed(agent)) {
    throw new InteractiveAgentPolicyError(agent, entryPoint);
  }
}
