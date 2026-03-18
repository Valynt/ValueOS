/**
 * Allowlist enforcement delegates to ModelRegistry, which is the single
 * source of truth for approved Together AI models. This file retains the
 * public API surface so existing callers need no import changes.
 */

import {
  getActiveModelIds,
  assertModelAllowed as registryAssertAllowed,
  ModelDeniedError as RegistryModelDeniedError,
} from '../lib/agent-fabric/ModelRegistry.js';

export { ModelDeniedError } from '../lib/agent-fabric/ModelRegistry.js';

export const MODEL_POLICY_VERSION = '2026-02-14.1';

export type LlmProvider = 'together_ai' | 'openai';

/**
 * Dynamic allowlist derived from the registry's active models.
 * Kept for backward compatibility with code that reads MODEL_ALLOWLIST directly.
 */
export const MODEL_ALLOWLIST = {
  get together_ai() {
    return getActiveModelIds();
  },
  openai: ['gpt-4o-mini'] as string[],
};

export function assertModelAllowed(provider: LlmProvider, model: string): void {
  if (provider === 'together_ai') {
    registryAssertAllowed(model);
    return;
  }
  if (provider === 'openai') {
    if (!MODEL_ALLOWLIST.openai.includes(model)) {
      throw new RegistryModelDeniedError(model, `not approved for provider 'openai'`);
    }
    return;
  }
}

export function findProviderForModel(model: string): LlmProvider | null {
  if (getActiveModelIds().includes(model)) return 'together_ai';
  if (MODEL_ALLOWLIST.openai.includes(model)) return 'openai';
  return null;
}

export function assertKnownApprovedModel(model: string): LlmProvider {
  const provider = findProviderForModel(model);
  if (!provider) {
    throw new RegistryModelDeniedError(model, 'not in approved registry');
  }
  return provider;
}
