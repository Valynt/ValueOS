/**
 * ModelRegistry
 *
 * Curated registry of approved Together AI models with stable aliases.
 * Replaces the hardcoded MODEL_ALLOWLIST in config/models.ts.
 *
 * Agents and callers reference stable aliases (e.g. 'default-chat') rather
 * than raw model ID strings, so model swaps require only a registry update.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelRecord {
  /** Exact Together AI model string passed to the API */
  modelId: string;
  family: string;
  mode: 'chat' | 'vision' | 'embedding';
  contextWindow: number;
  /** Per 1M tokens, USD */
  pricing: { input: number; output: number };
  /** Whether the model supports response_format: json_schema */
  supportsStructuredOutputs: boolean;
  supportsTools: boolean;
  latencyTier: 'fast' | 'standard' | 'slow';
  qualityTier: 'economy' | 'standard' | 'premium';
  status: 'active' | 'canary' | 'deprecated' | 'blocked';
}

export type ModelAlias =
  | 'default-chat'
  | 'fast-chat'
  | 'json-structured'
  | 'vision-primary'
  | 'embedding-default'
  | 'reasoning-premium';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: ModelRecord[] = [
  {
    modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    family: 'llama',
    mode: 'chat',
    contextWindow: 131072,
    pricing: { input: 0.88, output: 0.88 },
    supportsStructuredOutputs: true,
    supportsTools: true,
    latencyTier: 'standard',
    qualityTier: 'standard',
    status: 'active',
  },
  {
    modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    family: 'llama',
    mode: 'chat',
    contextWindow: 131072,
    pricing: { input: 0.18, output: 0.18 },
    supportsStructuredOutputs: false,
    supportsTools: false,
    latencyTier: 'fast',
    qualityTier: 'economy',
    status: 'active',
  },
  {
    modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    family: 'qwen',
    mode: 'chat',
    contextWindow: 32768,
    pricing: { input: 0.6, output: 0.6 },
    supportsStructuredOutputs: true,
    supportsTools: true,
    latencyTier: 'standard',
    qualityTier: 'standard',
    status: 'active',
  },
  {
    modelId: 'deepseek-ai/DeepSeek-R1',
    family: 'deepseek',
    mode: 'chat',
    contextWindow: 163839,
    pricing: { input: 3.0, output: 7.0 },
    supportsStructuredOutputs: true,
    supportsTools: true,
    latencyTier: 'slow',
    qualityTier: 'premium',
    status: 'active',
  },
  {
    modelId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    family: 'llama',
    mode: 'vision',
    contextWindow: 1048576,
    pricing: { input: 0.27, output: 0.85 },
    supportsStructuredOutputs: true,
    supportsTools: true,
    latencyTier: 'standard',
    qualityTier: 'standard',
    status: 'active',
  },
  {
    modelId: 'togethercomputer/m2-bert-80M-8k-retrieval',
    family: 'bert',
    mode: 'embedding',
    contextWindow: 8192,
    pricing: { input: 0.02, output: 0.02 },
    supportsStructuredOutputs: false,
    supportsTools: false,
    latencyTier: 'fast',
    qualityTier: 'standard',
    status: 'active',
  },
  // Deprecated models retained for backward compatibility
  {
    modelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    family: 'llama',
    mode: 'chat',
    contextWindow: 131072,
    pricing: { input: 0.88, output: 0.88 },
    supportsStructuredOutputs: false,
    supportsTools: false,
    latencyTier: 'standard',
    qualityTier: 'standard',
    status: 'deprecated',
  },
  {
    modelId: 'meta-llama/Llama-3-70b-chat-hf',
    family: 'llama',
    mode: 'chat',
    contextWindow: 8192,
    pricing: { input: 0.9, output: 0.9 },
    supportsStructuredOutputs: false,
    supportsTools: false,
    latencyTier: 'standard',
    qualityTier: 'standard',
    status: 'deprecated',
  },
];

const ALIAS_MAP: Record<ModelAlias, string> = {
  'default-chat': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'fast-chat': 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'json-structured': 'Qwen/Qwen2.5-72B-Instruct-Turbo',
  'reasoning-premium': 'deepseek-ai/DeepSeek-R1',
  'vision-primary': 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  'embedding-default': 'togethercomputer/m2-bert-80M-8k-retrieval',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a stable alias to its ModelRecord.
 * Throws if the alias maps to a model that is blocked or not found.
 */
export function resolveAlias(alias: ModelAlias): ModelRecord {
  const modelId = ALIAS_MAP[alias];
  const record = REGISTRY.find((r) => r.modelId === modelId);
  if (!record) {
    throw new Error(`ModelRegistry: alias '${alias}' maps to unknown model '${modelId}'`);
  }
  if (record.status === 'blocked') {
    throw new Error(`ModelRegistry: model '${modelId}' is blocked`);
  }
  return record;
}

/**
 * Look up capabilities for a specific model ID.
 * Returns undefined if the model is not in the registry.
 */
export function getCapabilities(modelId: string): ModelRecord | undefined {
  return REGISTRY.find((r) => r.modelId === modelId);
}

/**
 * Assert that a model ID is permitted for use.
 * Throws ModelDeniedError if the model is blocked, deprecated, or unknown.
 */
export class ModelDeniedError extends Error {
  readonly code = 'MODEL_DENIED' as const;
  readonly status = 403;

  constructor(public readonly modelId: string, reason: string) {
    super(`Model '${modelId}' is not approved: ${reason}`);
    this.name = 'ModelDeniedError';
  }
}

export function assertModelAllowed(modelId: string): void {
  const record = REGISTRY.find((r) => r.modelId === modelId);
  if (!record) {
    throw new ModelDeniedError(modelId, 'not in approved registry');
  }
  if (record.status === 'blocked') {
    throw new ModelDeniedError(modelId, 'blocked');
  }
  if (record.status === 'deprecated') {
    throw new ModelDeniedError(modelId, 'deprecated — use an active model or alias');
  }
}

/**
 * Returns all active model IDs (for allowlist checks and health reporting).
 */
export function getActiveModelIds(): string[] {
  return REGISTRY.filter((r) => r.status === 'active').map((r) => r.modelId);
}
