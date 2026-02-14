export const MODEL_POLICY_VERSION = '2026-02-14.1';

export const MODEL_ALLOWLIST = {
  together_ai: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
    'primary-model',
    'secondary-model',
  ],
  openai: ['gpt-4o-mini'],
} as const;

export type LlmProvider = keyof typeof MODEL_ALLOWLIST;

const PROVIDERS = Object.keys(MODEL_ALLOWLIST) as LlmProvider[];

export class ModelDeniedError extends Error {
  readonly code = 'MODEL_DENIED' as const;
  readonly status = 403;

  constructor(public readonly provider: LlmProvider, public readonly model: string) {
    super(`Model '${model}' is not approved for provider '${provider}'`);
    this.name = 'ModelDeniedError';
  }
}

export function assertModelAllowed(provider: LlmProvider, model: string): void {
  if (!MODEL_ALLOWLIST[provider].includes(model as never)) {
    throw new ModelDeniedError(provider, model);
  }
}

export function findProviderForModel(model: string): LlmProvider | null {
  for (const provider of PROVIDERS) {
    if (MODEL_ALLOWLIST[provider].includes(model as never)) {
      return provider;
    }
  }

  return null;
}

export function assertKnownApprovedModel(model: string): LlmProvider {
  const provider = findProviderForModel(model);
  if (!provider) {
    throw new ModelDeniedError('together_ai', model);
  }

  return provider;
}
