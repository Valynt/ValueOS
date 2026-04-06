#!/usr/bin/env node
/**
 * prewarm-llm-cache.ts
 *
 * Pre-warms the LLM cache with common onboarding prompts so the first cohort
 * of users does not pay cold-start latency on their initial agent invocations.
 *
 * Run against staging before launch, then against production immediately after
 * the production deploy smoke tests pass.
 *
 * Usage (from repo root):
 *   pnpm cache:prewarm -- --tenant-id <uuid> [--model <name>] [--dry-run]
 *
 * Or directly:
 *   pnpm --filter @valueos/backend exec tsx ../../scripts/prewarm-llm-cache.ts \
 *     --tenant-id <uuid> [--model <name>] [--dry-run]
 *
 * Required env vars:
 *   REDIS_URL          — Redis connection string (e.g. redis://localhost:6379)
 *   TOGETHER_API_KEY   — LLM provider key (or OPENAI_API_KEY / ANTHROPIC_API_KEY)
 *   LLM_PROVIDER       — "together" | "openai" | "anthropic" (default: together)
 *   LLM_MODEL          — model name (overridden by --model flag)
 *
 * The script calls the LLM for each prompt, stores the response in Redis under
 * the tenant-scoped key, and reports a summary. Prompts that are already cached
 * are skipped.
 */

import { parseArgs } from 'node:util';

import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    'tenant-id': { type: 'string' },
    model: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
  args: process.argv.slice(2).filter(a => a !== '--'),
});

if (args.help) {
  console.log(`
Usage: tsx scripts/prewarm-llm-cache.ts --tenant-id <uuid> [--model <name>] [--dry-run]

Pre-warms the LLM cache with common onboarding prompts.

Options:
  --tenant-id   Tenant UUID to scope cache keys (required)
  --model       LLM model name (default: LLM_MODEL env var or meta-llama/Llama-3.3-70B-Instruct-Turbo)
  --dry-run     Print which prompts would be warmed without calling the LLM or writing to Redis
  --help        Show this message
`);
  process.exit(0);
}

const tenantId = args['tenant-id'];
if (!tenantId) {
  console.error('Error: --tenant-id is required');
  process.exit(1);
}

const model =
  args.model ??
  process.env.LLM_MODEL ??
  'meta-llama/Llama-3.3-70B-Instruct-Turbo';

const isDryRun = args['dry-run'] ?? false;

// ---------------------------------------------------------------------------
// Onboarding prompt corpus
//
// These are the prompts most likely to be submitted by the first cohort of
// users during onboarding. Warming these reduces cold-start latency for the
// OpportunityAgent, TargetAgent, and NarrativeAgent on common inputs.
//
// Add or remove entries as the onboarding flow evolves. Each entry must have:
//   - label:    human-readable name for logging
//   - messages: the exact messages array passed to the LLM
//   - options:  any model options that affect the cache key (temperature, etc.)
// ---------------------------------------------------------------------------

interface PromptEntry {
  label: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  options?: Record<string, unknown>;
}

const ONBOARDING_PROMPTS: PromptEntry[] = [
  {
    label: 'opportunity-discovery-intro',
    messages: [
      {
        role: 'system',
        content:
          'You are a value engineering assistant. Help the user identify business value opportunities.',
      },
      {
        role: 'user',
        content:
          'What are the most common sources of measurable business value in enterprise software deployments?',
      },
    ],
    options: { temperature: 0.3, max_tokens: 512 },
  },
  {
    label: 'hypothesis-generation-prompt',
    messages: [
      {
        role: 'system',
        content:
          'You are a value engineering assistant. Generate a structured value hypothesis.',
      },
      {
        role: 'user',
        content:
          'Generate a value hypothesis for reducing manual data entry time in a sales operations team of 20 people.',
      },
    ],
    options: { temperature: 0.3, max_tokens: 512 },
  },
  {
    label: 'kpi-target-suggestion',
    messages: [
      {
        role: 'system',
        content:
          'You are a value engineering assistant. Suggest measurable KPI targets.',
      },
      {
        role: 'user',
        content:
          'Suggest three measurable KPI targets for a CRM automation initiative with a 6-month timeline.',
      },
    ],
    options: { temperature: 0.3, max_tokens: 512 },
  },
  {
    label: 'roi-framing-intro',
    messages: [
      {
        role: 'system',
        content:
          'You are a value engineering assistant. Help frame ROI for a CFO audience.',
      },
      {
        role: 'user',
        content:
          'How should I frame the ROI of a workflow automation project for a CFO who prioritises payback period over NPV?',
      },
    ],
    options: { temperature: 0.3, max_tokens: 512 },
  },
  {
    label: 'assumption-validation-prompt',
    messages: [
      {
        role: 'system',
        content:
          'You are a value engineering assistant. Help validate business case assumptions.',
      },
      {
        role: 'user',
        content:
          'What evidence should I collect to validate the assumption that automating invoice processing saves 4 hours per employee per week?',
      },
    ],
    options: { temperature: 0.3, max_tokens: 512 },
  },
];

// ---------------------------------------------------------------------------
// Cache key construction (mirrors packages/backend/src/services/core/LLMCache.ts)
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';


function buildCacheKey(
  tenantId: string,
  model: string,
  prompt: string,
  options?: unknown,
): string {
  const raw = JSON.stringify({ prompt, model, options: options ?? {} });
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `llm:cache:${tenantId}:${model}:${hash}`;
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callLLM(
  messages: PromptEntry['messages'],
  modelName: string,
  options: Record<string, unknown> = {},
): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? 'together';

  let apiKey: string;
  let baseUrl: string;

  if (provider === 'together') {
    apiKey = process.env.TOGETHER_API_KEY ?? '';
    baseUrl = process.env.TOGETHER_API_BASE_URL ?? 'https://api.together.xyz/v1';
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY ?? '';
    baseUrl = 'https://api.openai.com/v1';
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    baseUrl = 'https://api.anthropic.com/v1';
  } else {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }

  if (!apiKey) {
    throw new Error(
      `LLM API key not set. Set ${provider.toUpperCase()}_API_KEY (or TOGETHER_API_KEY for together).`,
    );
  }

  const body = JSON.stringify({
    model: modelName,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 512,
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return data.choices[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  console.log(`LLM cache pre-warm`);
  console.log(`  tenant:   ${tenantId}`);
  console.log(`  model:    ${model}`);
  console.log(`  prompts:  ${ONBOARDING_PROMPTS.length}`);
  console.log(`  dry-run:  ${isDryRun}`);
  console.log(`  redis:    ${redisUrl.replace(/:\/\/.*@/, '://<redacted>@')}`);
  console.log('');

  const redis = isDryRun
    ? null
    : new Redis(redisUrl, { maxRetriesPerRequest: 3 });

  let warmed = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of ONBOARDING_PROMPTS) {
    const promptText = entry.messages.map((m) => m.content).join('\n');
    const cacheKey = buildCacheKey(tenantId, model, promptText, entry.options);

    if (isDryRun) {
      console.log(`[dry-run] would warm: ${entry.label} → ${cacheKey}`);
      warmed++;
      continue;
    }

    // Check if already cached
    const existing = await redis!.get(cacheKey);
    if (existing) {
      console.log(`[skip]   ${entry.label} — already cached`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`[warm]   ${entry.label} … `);
      const start = Date.now();
      const responseText = await callLLM(entry.messages, model, entry.options ?? {});
      const elapsed = Date.now() - start;

      const cacheEntry = JSON.stringify({
        response: responseText,
        model,
        promptTokens: 0,   // not tracked in pre-warm; populated on real hits
        completionTokens: 0,
        cost: 0,
        cachedAt: new Date().toISOString(),
        hitCount: 0,
      });

      // TTL: 24h (matches LLMCache default)
      await redis!.set(cacheKey, cacheEntry, 'EX', 86400);
      console.log(`done (${elapsed}ms)`);
      warmed++;
    } catch (err) {
      console.log(`FAILED`);
      console.error(`  → ${(err as Error).message}`);
      failed++;
    }
  }

  if (redis) {
    await redis.quit();
  }

  console.log('');
  console.log(`Summary: ${warmed} warmed, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
