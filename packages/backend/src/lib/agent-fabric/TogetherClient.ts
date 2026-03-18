/**
 * TogetherClient
 *
 * Singleton wrapper around the official together-ai SDK client.
 * All Together API calls (chat, streaming, embeddings) go through this instance.
 */

import { getEnvVar } from '@shared/lib/env';
import Together from 'together-ai';


let _client: Together | null = null;

/**
 * Returns the shared Together client, constructing it on first call.
 * Reads TOGETHER_API_KEY and TOGETHER_API_BASE_URL from environment.
 */
export function getTogetherClient(): Together {
  if (_client) return _client;

  const apiKey = getEnvVar('TOGETHER_API_KEY');
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY is not set');
  }

  const baseURL = (getEnvVar('TOGETHER_API_BASE_URL') as string | undefined) || 'https://api.together.xyz/v1';
  const timeoutMs = Number(getEnvVar('TOGETHER_TIMEOUT_MS') || '30000');

  _client = new Together({
    apiKey: String(apiKey),
    baseURL,
    timeout: timeoutMs,
    // SDK has built-in retry; we layer our own circuit breaker on top so disable SDK retries
    maxRetries: 0,
  });

  return _client;
}

/**
 * Reset the singleton — used in tests to inject a fresh client.
 */
export function _resetTogetherClient(): void {
  _client = null;
}
