import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULTS = {
  provider: 'mock',
  model: 'mock/gpt-safe',
  timeoutMs: 15000,
  retries: 2,
  maxTokens: 1024,
  policyVersion: '2026.01',
};

export function getRuntimeConfig() {
  return {
    provider: process.env.LLM_PROVIDER ?? DEFAULTS.provider,
    model: process.env.LLM_MODEL ?? DEFAULTS.model,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? DEFAULTS.timeoutMs),
    retries: Number(process.env.LLM_RETRIES ?? DEFAULTS.retries),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? DEFAULTS.maxTokens),
    policyVersion: process.env.LLM_POLICY_VERSION ?? DEFAULTS.policyVersion,
    baseUrl: process.env.LLM_BASE_URL ?? '',
    apiKeyPresent: Boolean(process.env.LLM_API_KEY),
  };
}

export function sanitizeRuntimeConfig(config) {
  return {
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    maxTokens: config.maxTokens,
    policyVersion: config.policyVersion,
    baseUrlConfigured: Boolean(config.baseUrl),
    apiKeyPresent: config.apiKeyPresent,
  };
}

export function evaluatePolicy(userPrompt, { allowTools = false } = {}) {
  const lowerPrompt = userPrompt.toLowerCase();
  const injectionSignals = [
    'ignore previous instructions',
    'reveal system prompt',
    'bypass policy',
    'override safety',
    'developer mode',
  ];

  const toolSignals = ['run shell', 'execute command', 'call tool', 'invoke tool'];

  const hasInjection = injectionSignals.some((signal) => lowerPrompt.includes(signal));
  const hasToolRequest = toolSignals.some((signal) => lowerPrompt.includes(signal));

  if (hasInjection) {
    return {
      decision: 'blocked',
      reason: 'prompt_injection_detected',
      assistantText:
        'I cannot follow requests to override instructions or expose hidden prompts. I can help with a safe alternative.',
      toolCalled: false,
    };
  }

  if (hasToolRequest && !allowTools) {
    return {
      decision: 'blocked',
      reason: 'tool_use_denied_by_policy',
      assistantText: 'Tool execution is disabled for this request by policy.',
      toolCalled: false,
    };
  }

  return {
    decision: 'allowed',
    reason: 'safe',
    assistantText: 'Request accepted under current policy controls.',
    toolCalled: hasToolRequest && allowTools,
  };
}

export async function createArtifactBundle(prefix = 'verify') {
  const runId = `${new Date().toISOString().replace(/[.:]/g, '-')}-${prefix}`;
  const runDir = path.join('artifacts', 'llm-readiness', runId);
  await fs.mkdir(runDir, { recursive: true });

  return {
    runId,
    runDir,
    runJsonPath: path.join(runDir, 'run.json'),
    callsJsonlPath: path.join(runDir, 'calls.jsonl'),
    toolcallsJsonlPath: path.join(runDir, 'toolcalls.jsonl'),
  };
}

export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeJsonl(filePath, rows) {
  const content = rows.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(filePath, content.length > 0 ? `${content}\n` : '', 'utf8');
}
