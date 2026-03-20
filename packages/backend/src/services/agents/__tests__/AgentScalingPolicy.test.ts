import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  AGENT_SCALING_POLICY,
  INTERACTIVE_AGENT_ALLOWLIST,
  SCALE_TO_ZERO_AGENT_DENYLIST,
} from '../AgentScalingPolicy.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '../../../../../../');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

function extractKedaScaledObjects(fileContents: string): Array<{ name: string; minReplicaCount: number }> {
  const matches = [...fileContents.matchAll(/name:\s+([a-z-]+-agent)[\s\S]*?minReplicaCount:\s+(\d+)/g)];
  return matches.map((match) => ({
    name: match[1] ?? '',
    minReplicaCount: Number(match[2] ?? '0'),
  }));
}

function findMinReplicasForAgent(fileContents: string, kubernetesName: string): number | null {
  const pattern = new RegExp(`name:\\s+${kubernetesName}[\\s\\S]*?minReplicas:\\s+(\\d+)`);
  const match = fileContents.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

describe('AgentScalingPolicy', () => {
  it('keeps the interactive allowlist aligned with the scaling strategy', () => {
    expect(INTERACTIVE_AGENT_ALLOWLIST).toEqual([
      'opportunity',
      'target',
      'integrity',
      'expansion',
      'realization',
      'financial-modeling',
    ]);
  });

  it('keeps the scale-to-zero denylist aligned with KEDA low-frequency agents', () => {
    expect(SCALE_TO_ZERO_AGENT_DENYLIST).toEqual([
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
    ]);
  });

  it('requires non-zero warm capacity for every interactive allowlisted agent manifest', () => {
    const manifestContents = [
      'infra/k8s/base/agents/opportunity/hpa.yaml',
      'infra/k8s/base/agents/core-lifecycle-hpa.yaml',
      'infra/k8s/base/agents/realization/hpa.yaml',
      'infra/k8s/base/agents/analysis-agents-hpa.yaml',
    ].map(readRepoFile).join('\n---\n');

    for (const agent of INTERACTIVE_AGENT_ALLOWLIST) {
      const descriptor = AGENT_SCALING_POLICY[agent];
      const minReplicas = findMinReplicasForAgent(manifestContents, descriptor.kubernetesName);
      expect(minReplicas, `${descriptor.kubernetesName} should declare minReplicas`).not.toBeNull();
      expect(minReplicas, `${descriptor.kubernetesName} must stay warm for interactive traffic`).toBeGreaterThan(0);
      expect(minReplicas).toBe(descriptor.minWarmReplicas);
    }
  });

  it('keeps every denylisted KEDA ScaledObject at minReplicaCount 0 with async-only labels', () => {
    const manifest = readRepoFile('infra/k8s/base/agents/low-frequency-keda-scaledobjects.yaml');
    const scaledObjects = extractKedaScaledObjects(manifest);
    const names = scaledObjects.map((entry) => entry.name).sort();

    expect(names).toEqual(
      SCALE_TO_ZERO_AGENT_DENYLIST.map((agent) => AGENT_SCALING_POLICY[agent].kubernetesName).sort(),
    );

    for (const entry of scaledObjects) {
      expect(entry.minReplicaCount, `${entry.name} must remain scale-to-zero`).toBe(0);
      expect(manifest).toContain(`name: ${entry.name}`);
      expect(manifest).toContain('scaling.valueos.io/request-path-policy: async-only');
      expect(manifest).toContain('scaling.valueos.io/cold-start-class: scale-to-zero-async');
    }
  });

  it('guards interactive orchestration entry points against async-only agents', () => {
    const queryExecutor = readRepoFile('packages/backend/src/runtime/execution-runtime/QueryExecutor.ts');
    const actionRouterHandlers = readRepoFile('packages/backend/src/services/agents/ActionRouterHandlers.ts');

    expect(queryExecutor).toContain("assertInteractiveAgentAllowed(agentType, 'QueryExecutor._processQuerySync')");
    expect(queryExecutor).toContain("assertInteractiveAgentAllowed(agentType, 'QueryExecutor.processQueryAsync')");
    expect(actionRouterHandlers).toContain("assertInteractiveAgentAllowed(action.agentId as AgentType, 'ActionRouter.invokeAgent')");
    expect(actionRouterHandlers).toContain("assertInteractiveAgentAllowed('narrative', 'ActionRouter.showExplanation')");
  });
});
