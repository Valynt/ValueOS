import { logger } from '../lib/logger';
import { ModelCard, ModelCardSchema, MODEL_CARD_SCHEMA_VERSION } from '../types/modelCard';

const MODEL_CARDS: Record<string, ModelCard> = {
  opportunity: {
    model_version: 'Meta-Llama-3.1-70B-Instruct-Turbo',
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
    prompt_contract_hash: '0x9f21c8f7b6d4a3e1c2d5f7a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9',
  },
  target: {
    model_version: 'OpenAI-gpt-4.1-preview',
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
    prompt_contract_hash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3',
  },
  realization: {
    model_version: 'Claude-3-opus-2024-11-21',
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
    prompt_contract_hash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a1b2',
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
