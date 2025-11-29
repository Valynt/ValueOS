import type { LLMProvider } from '../lib/agent-fabric/llm-types';

// Use a local helper to avoid relying on global ImportMeta typings
const env = (import.meta as any)?.env ?? {};

// Prevent leaking provider keys to the browser bundle
const clientLeakedSecrets = [
  'VITE_OPENAI_API_KEY',
  'VITE_TOGETHER_API_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
].filter((key) => Boolean(env[key]));

if (clientLeakedSecrets.length > 0) {
  console.error(
    `[Security] Sensitive keys must not be exposed to client runtime: ${clientLeakedSecrets.join(', ')}`
  );
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    throw new Error('Sensitive API keys detected in client environment variables');
  }
}

const rawProvider = (env.VITE_LLM_PROVIDER || '').toLowerCase();

const provider: LLMProvider = rawProvider === 'openai' ? 'openai' : 'together';

const gatingEnabledEnv = env.VITE_LLM_GATING_ENABLED;
const gatingEnabled = gatingEnabledEnv === 'false' ? false : true;

export const llmConfig = {
  provider,
  gatingEnabled,
};
