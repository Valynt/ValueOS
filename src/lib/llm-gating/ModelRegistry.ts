/**
 * Model Registry
 *
 * Registry of LLM models with their architectural traits.
 * Based on "Gated Attention for Large Language Models" research findings.
 *
 * Tracks:
 * - MoE (Mixture of Experts) architecture
 * - Gated attention mechanisms
 * - Sparse attention capabilities
 * - Context length limits and attention sink behavior
 */

import { ModelArchitectureTraits, ModelSelectionCriteria } from './types';

/**
 * Model architecture registry
 */
export const MODEL_REGISTRY: Record<string, ModelArchitectureTraits> = {
  // =========================================================================
  // Together.ai Models
  // =========================================================================

  // Meta Llama Models
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': {
    hasMoE: false,
    hasGatedAttention: false, // Standard transformer attention
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 2,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 1,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },
  'meta-llama/Llama-3-70b-chat-hf': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 8000,
    costTier: 2,
    recommendedForRAG: false, // Shorter context
    recommendedForFineTuning: true,
  },
  'meta-llama/Llama-3-8b-chat-hf': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 8000,
    costTier: 1,
    recommendedForRAG: false,
    recommendedForFineTuning: true,
  },

  // Mistral/Mixtral Models (MoE Architecture)
  'mistralai/Mixtral-8x7B-Instruct-v0.1': {
    hasMoE: true, // 8 experts, 2 active per token
    hasGatedAttention: true, // Sparse MoE with gating
    hasSparseAttention: true,
    effectiveContextLength: 32000,
    costTier: 2,
    recommendedForRAG: true, // MoE handles long context well
    recommendedForFineTuning: false, // MoE harder to fine-tune
  },
  'mistralai/Mixtral-8x22B-Instruct-v0.1': {
    hasMoE: true,
    hasGatedAttention: true,
    hasSparseAttention: true,
    effectiveContextLength: 65000,
    costTier: 3,
    recommendedForRAG: true,
    recommendedForFineTuning: false,
  },
  'mistralai/Mistral-7B-Instruct-v0.3': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 32000,
    costTier: 1,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },

  // Microsoft Phi Models
  'microsoft/phi-4-mini': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 16000,
    costTier: 0,
    recommendedForRAG: false,
    recommendedForFineTuning: true,
  },
  'microsoft/phi-3-medium-128k-instruct': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 1,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },

  // Qwen Models
  'Qwen/Qwen2-72B-Instruct': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 32000,
    costTier: 2,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },

  // DeepSeek Models (MoE)
  'deepseek-ai/DeepSeek-V2-Chat': {
    hasMoE: true, // DeepSeek uses MoE architecture
    hasGatedAttention: true,
    hasSparseAttention: true,
    effectiveContextLength: 128000,
    costTier: 2,
    recommendedForRAG: true,
    recommendedForFineTuning: false,
  },

  // =========================================================================
  // OpenAI Models
  // =========================================================================

  'gpt-4': {
    hasMoE: true, // Rumored to be MoE
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 8000,
    costTier: 4,
    recommendedForRAG: false, // Shorter context for base model
    recommendedForFineTuning: true,
  },
  'gpt-4-turbo': {
    hasMoE: true,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 3,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },
  'gpt-4o': {
    hasMoE: true,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 3,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },
  'gpt-4o-mini': {
    hasMoE: true,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 128000,
    costTier: 1,
    recommendedForRAG: true,
    recommendedForFineTuning: true,
  },
  'gpt-3.5-turbo': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 16000,
    costTier: 1,
    recommendedForRAG: false,
    recommendedForFineTuning: true,
  },

  // =========================================================================
  // Anthropic Models
  // =========================================================================

  'claude-3-opus-20240229': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 200000,
    costTier: 4,
    recommendedForRAG: true,
    recommendedForFineTuning: false,
  },
  'claude-3-sonnet-20240229': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 200000,
    costTier: 2,
    recommendedForRAG: true,
    recommendedForFineTuning: false,
  },
  'claude-3-haiku-20240307': {
    hasMoE: false,
    hasGatedAttention: false,
    hasSparseAttention: false,
    effectiveContextLength: 200000,
    costTier: 1,
    recommendedForRAG: true,
    recommendedForFineTuning: false,
  },
};

/**
 * Default traits for unknown models
 */
const DEFAULT_TRAITS: ModelArchitectureTraits = {
  hasMoE: false,
  hasGatedAttention: false,
  hasSparseAttention: false,
  effectiveContextLength: 4000,
  costTier: 2,
  recommendedForRAG: false,
  recommendedForFineTuning: false,
};

/**
 * Get architecture traits for a model
 */
export function getModelTraits(model: string): ModelArchitectureTraits {
  return MODEL_REGISTRY[model] || DEFAULT_TRAITS;
}

/**
 * Select best model based on criteria
 */
export function selectBestModel(
  criteria: ModelSelectionCriteria,
  availableModels: string[] = Object.keys(MODEL_REGISTRY)
): string | null {
  const candidates: Array<{ model: string; score: number; traits: ModelArchitectureTraits }> = [];

  for (const model of availableModels) {
    const traits = getModelTraits(model);
    let score = 0;

    // Filter by cost tier
    if (traits.costTier > criteria.maxCostTier) {
      continue;
    }

    // Filter by context length
    if (criteria.minContextLength && traits.effectiveContextLength < criteria.minContextLength) {
      continue;
    }

    // Score based on criteria match
    if (criteria.isRAGTask && traits.recommendedForRAG) {
      score += 30;
    }

    if (criteria.requiresLongContext && traits.effectiveContextLength >= 32000) {
      score += 20;
      if (traits.effectiveContextLength >= 128000) {
        score += 10;
      }
    }

    // Prefer MoE for complex tasks (reduces attention sink)
    if (criteria.isRAGTask && traits.hasMoE) {
      score += 15;
    }

    // Prefer gated attention for RAG (paper finding)
    if (criteria.isRAGTask && traits.hasGatedAttention) {
      score += 15;
    }

    // Prefer sparse attention for latency-sensitive tasks
    if (criteria.latencySensitive && traits.hasSparseAttention) {
      score += 10;
    }

    // Lower cost is better (inverted)
    score += (4 - traits.costTier) * 5;

    candidates.push({ model, score, traits });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates[0].model;
}

/**
 * Get models suitable for RAG tasks
 */
export function getRAGSuitableModels(maxCostTier: number = 3): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, traits]) => traits.recommendedForRAG && traits.costTier <= maxCostTier)
    .sort((a, b) => {
      // Prefer MoE > Gated Attention > Standard
      const aScore = (a[1].hasMoE ? 2 : 0) + (a[1].hasGatedAttention ? 1 : 0);
      const bScore = (b[1].hasMoE ? 2 : 0) + (b[1].hasGatedAttention ? 1 : 0);
      return bScore - aScore;
    })
    .map(([model]) => model);
}

/**
 * Get models suitable for fine-tuning
 */
export function getFineTuningSuitableModels(): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, traits]) => traits.recommendedForFineTuning)
    .map(([model]) => model);
}

/**
 * Check if a model has gated architecture benefits
 */
export function hasGatedArchitecture(model: string): boolean {
  const traits = getModelTraits(model);
  return traits.hasMoE || traits.hasGatedAttention || traits.hasSparseAttention;
}

/**
 * Get cost-effective alternative for a model
 */
export function getCostEffectiveAlternative(
  model: string,
  requireRAG: boolean = false
): string | null {
  const currentTraits = getModelTraits(model);
  const targetCostTier = Math.max(0, currentTraits.costTier - 1);

  return selectBestModel({
    requiresLongContext: currentTraits.effectiveContextLength >= 32000,
    isRAGTask: requireRAG,
    latencySensitive: false,
    maxCostTier: targetCostTier,
    minContextLength: Math.min(currentTraits.effectiveContextLength, 8000),
  });
}
