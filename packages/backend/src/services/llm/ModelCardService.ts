/**
 * ModelCardService
 *
 * prompt_contract_hash is computed at startup as sha256(policyFileContent)
 * so it changes whenever the agent's policy file changes. Model names are
 * sourced from the policy files in policies/agents/.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { logger } from '../../lib/logger.js'
import { MODEL_CARD_SCHEMA_VERSION, ModelCard, ModelCardSchema } from '../types/modelCard.js'

/**
 * Compute sha256 of the agent's policy file content.
 * Falls back to sha256("no-policy-file") when the file is absent so the
 * hash is still deterministic and non-fabricated.
 */
function computePolicyHash(agentPolicyName: string): string {
  const policyPath = resolve(process.cwd(), 'policies', 'agents', `${agentPolicyName}.json`);
  const content = existsSync(policyPath)
    ? readFileSync(policyPath, 'utf-8')
    : `no-policy-file:${agentPolicyName}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Read the primary model from the agent's policy file.
 * Falls back to the provided default when the policy file is absent.
 */
function readPrimaryModel(agentPolicyName: string, fallback: string): string {
  const policyPath = resolve(process.cwd(), 'policies', 'agents', `${agentPolicyName}.json`);
  if (!existsSync(policyPath)) return fallback;
  try {
    const policy = JSON.parse(readFileSync(policyPath, 'utf-8')) as { allowedModels?: string[] };
    return policy.allowedModels?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

const MODEL_CARDS: Record<string, ModelCard> = {
  opportunity: {
    model_version: readPrimaryModel('opportunity-agent', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
    safety_constraints: [
      'Guardrails enforce client redline exclusions and SOC2 privacy controls',
      'Outputs must include evidence-backed assumptions with source links',
      'Hallucination detection enabled via secureInvoke validation',
    ],
    known_limitations: [
      'Assumes customer telemetry availability for revenue lift estimates',
      'May underperform with incomplete industry benchmarks',
      'Relies on cached buyer personas when CRM enrichment fails',
    ],
    training_cutoff: '2024-10-01',
    prompt_contract_hash: computePolicyHash('opportunity-agent'),
  },
  target: {
    model_version: readPrimaryModel('target-agent', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
    safety_constraints: [
      'PII scrubbing enabled with regional residency enforcement',
      'Risk-adjusted ROI must include sensitivity range',
      'Rejects speculative metrics without corroborating evidence',
    ],
    known_limitations: [
      'Requires structured baseline metrics for accurate targeting',
      'Financial ratios may drift on niche industries without overrides',
      'Confidence scores drop when procurement data is unavailable',
    ],
    training_cutoff: '2024-06-30',
    prompt_contract_hash: computePolicyHash('target-agent'),
  },
  realization: {
    model_version: readPrimaryModel('realization-agent', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
    safety_constraints: [
      'Change management actions require explicit approval markers',
      'Operational playbooks limited to pre-approved system scopes',
      'Citations must reference verified knowledge-base documents',
    ],
    known_limitations: [
      'Automation guidance assumes modern SaaS tooling availability',
      'Performance baselines rely on last-known telemetry snapshot',
      'Does not execute scripts; returns runbook steps only',
    ],
    training_cutoff: '2024-11-21',
    prompt_contract_hash: computePolicyHash('realization-agent'),
  },
};

export class ModelCardService {
  private readonly schemaVersion = MODEL_CARD_SCHEMA_VERSION;

  getModelCard(agentId: string): { modelCard: ModelCard; schemaVersion: string } | null {
    const normalizedId = agentId.toLowerCase();
    const record = MODEL_CARDS[normalizedId];

    if (!record) {
      return null;
    }

    try {
      const parsed = ModelCardSchema.parse(record);
      return { modelCard: parsed, schemaVersion: this.schemaVersion };
    } catch (error) {
      logger.error('Model card validation failed', error instanceof Error ? error : undefined, {
        agentId,
      });
      return null;
    }
  }
}

export const modelCardService = new ModelCardService();
