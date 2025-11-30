import type { LLMProvider } from '../lib/agent-fabric/llm-types';

// Use a local helper to avoid relying on global ImportMeta typings
const env = (import.meta as any)?.env ?? {};

const rawProvider = (env.VITE_LLM_PROVIDER || '').toLowerCase();
const provider: LLMProvider = rawProvider === 'openai' ? 'openai' : 'together';

const gatingEnabledEnv = env.VITE_LLM_GATING_ENABLED;
const gatingEnabled = gatingEnabledEnv === 'false' ? false : true;

export const llmConfig = {
  provider,
  gatingEnabled,
};
