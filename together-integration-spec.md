# Spec: Together.ai Proper SDK Integration

## Problem Statement

The current Together.ai integration is hand-rolled: `LLMGateway` and `EmbeddingService` both call the Together API via raw `fetch`. This means:

- No typed client — auth, headers, retries, and error shapes are all manual
- No structured outputs — agents receive plain text, then `JSON.parse` + Zod post-hoc, which fails on malformed responses
- The model allowlist (`config/models.ts`) contains only 3 real model IDs plus placeholder strings (`primary-model`, `secondary-model`), and the pricing table in `LLMCostTracker.ts` is stale (2024 models)
- `TOGETHER_PRIMARY_MODEL_NAME`, `TOGETHER_SECONDARY_MODEL_NAME`, `TOGETHER_API_BASE_URL`, and `TOGETHER_TIMEOUT_MS` are read in code but absent from `.env.example`
- Agents reference model IDs directly rather than stable aliases, so swapping models requires touching agent code
- `EmbeddingService` is on the same raw-fetch pattern and needs to be brought onto the same client

---

## Goals

1. Replace raw `fetch` in `LLMGateway` and `EmbeddingService` with the official `together-ai` TypeScript SDK
2. Add structured outputs support (JSON schema mode) as the default path for schema-shaped agent responses, with Zod validation retained as a safety net
3. Introduce a curated model registry with stable aliases, replacing hardcoded model ID strings
4. Update the pricing table and model allowlist to reflect the current Together catalog
5. Document all Together-related environment variables in `.env.example`

**Non-goals for this phase:** function calling wiring, image/audio/video generation, dedicated endpoint support, full provider feature parity.

---

## Requirements

### R1 — Install and wire the `together-ai` SDK

- Add `together-ai` to `packages/backend/package.json`
- Create `packages/backend/src/lib/agent-fabric/TogetherClient.ts` — a singleton that constructs a `Together` client from `TOGETHER_API_KEY` and `TOGETHER_API_BASE_URL`
- `LLMGateway.executeTogetherCompletion` replaces its `fetch` call with `togetherClient.chat.completions.create(...)`
- `LLMGateway.completeRawStream` replaces its `fetch`-based SSE loop with `togetherClient.chat.completions.create({ stream: true, ... })`
- `EmbeddingService.generateEmbedding` replaces its `fetch` call with `togetherClient.embeddings.create(...)`
- All Together API errors are caught and re-thrown as typed errors (preserve existing error message format for callers)

### R2 — Structured outputs (JSON schema mode)

- Add an optional `responseSchema` field to `LLMRequest` (a JSON Schema object, derived from the caller's Zod schema)
- When `responseSchema` is present and the model supports structured outputs, `LLMGateway` passes `response_format: { type: "json_schema", json_schema: { name: "response", schema: responseSchema } }` to the Together API
- `BaseAgent.secureInvoke` derives the JSON schema from its Zod schema (using `zod-to-json-schema`) and passes it through `LLMRequest.responseSchema`
- Zod validation runs after the response regardless — structured outputs reduce parse failures but do not replace runtime validation
- Fallback: if the model does not support structured outputs (detectable from the model registry, see R3), the gateway omits `response_format` and falls back to the current freeform + post-parse path
- The fallback path is also used when `responseSchema` is absent (freeform generation tasks)

### R3 — Model registry and alias resolver

Create `packages/backend/src/lib/agent-fabric/ModelRegistry.ts`:

```typescript
export interface ModelRecord {
  modelId: string;           // exact Together model string
  family: string;
  mode: 'chat' | 'vision' | 'embedding';
  contextWindow: number;
  pricing: { input: number; output: number }; // per 1M tokens
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
```

- The registry ships with a curated static list of approved models (see Appendix A)
- `resolveAlias(alias: ModelAlias): ModelRecord` maps stable aliases to concrete model IDs
- `getCapabilities(modelId: string): ModelRecord` returns the record for a given model ID
- `assertModelAllowed(modelId: string): void` replaces the current `config/models.ts` function — checks `status !== 'blocked'` and `status !== 'deprecated'`
- `config/models.ts` is updated to delegate to `ModelRegistry` rather than maintaining its own list

### R4 — Pricing table update

- `LLMCostTracker.ts` pricing table is updated to include current Together models (see Appendix A)
- Stale 2024-only entries are retained but marked with a comment indicating deprecation
- The `default` fallback pricing entry is kept

### R5 — Environment variable documentation

Add the following to `.env.example` (non-secret section):

```bash
# Together.ai
TOGETHER_API_BASE_URL=https://api.together.xyz/v1
TOGETHER_PRIMARY_MODEL_NAME=meta-llama/Llama-3.3-70B-Instruct-Turbo
TOGETHER_SECONDARY_MODEL_NAME=meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
TOGETHER_TIMEOUT_MS=30000
```

`TOGETHER_API_KEY=` is already in `.env.local.example` — verify it remains there.

### R6 — Env validation

- `config/env-validation.ts` already has `TOGETHER_PRIMARY_MODEL_NAME` and `TOGETHER_SECONDARY_MODEL_NAME` as optional — no change needed for those
- Add `TOGETHER_API_BASE_URL` (optional, string URL) and `TOGETHER_TIMEOUT_MS` (optional, positive integer) as validated fields

---

## Acceptance Criteria

- [ ] `together-ai` SDK is installed and `TogetherClient.ts` singleton exists
- [ ] `LLMGateway.executeTogetherCompletion` uses the SDK, not raw `fetch`
- [ ] `LLMGateway.completeRawStream` uses the SDK streaming interface
- [ ] `EmbeddingService.generateEmbedding` uses the SDK
- [ ] `LLMRequest` has an optional `responseSchema` field
- [ ] `BaseAgent.secureInvoke` passes a JSON schema derived from its Zod schema
- [ ] `LLMGateway` passes `response_format: json_schema` when `responseSchema` is present and the model supports it
- [ ] `LLMGateway` falls back to freeform path when the model does not support structured outputs
- [ ] `ModelRegistry.ts` exists with the curated model list and alias resolver
- [ ] `assertModelAllowed` in `config/models.ts` delegates to `ModelRegistry`
- [ ] `LLMCostTracker.ts` pricing table includes current models
- [ ] All Together env vars are documented in `.env.example`
- [ ] Existing tests pass without modification (no breaking changes to `LLMGateway.complete` or `EmbeddingService` public interfaces)
- [ ] `pnpm run lint` passes
- [ ] `pnpm test` passes

---

## Implementation Steps

1. **Install SDK** — add `together-ai` and `zod-to-json-schema` to `packages/backend/package.json`, run `pnpm install`
2. **Create `TogetherClient.ts`** — singleton wrapper around `Together` client, reads `TOGETHER_API_KEY` and `TOGETHER_API_BASE_URL`
3. **Create `ModelRegistry.ts`** — curated model records, alias map, `resolveAlias`, `getCapabilities`, `assertModelAllowed`
4. **Update `config/models.ts`** — delegate `assertModelAllowed` to `ModelRegistry`; remove the hardcoded array
5. **Update `LLMGateway`** — replace `executeTogetherCompletion` and `completeRawStream` with SDK calls; add `responseSchema` to `LLMRequest`; wire structured outputs logic using `ModelRegistry.getCapabilities`
6. **Update `EmbeddingService`** — replace `fetch` with `togetherClient.embeddings.create`; update model default to use `ModelRegistry.resolveAlias('embedding-default')`
7. **Update `LLMCostTracker.ts`** — refresh pricing table with current models from Appendix A
8. **Update `BaseAgent.secureInvoke`** — derive JSON schema from Zod schema using `zod-to-json-schema`; pass as `responseSchema` on `LLMRequest`
9. **Update env files** — add Together vars to `.env.example`; update `config/env-validation.ts` for `TOGETHER_API_BASE_URL` and `TOGETHER_TIMEOUT_MS`
10. **Run tests and lint** — verify no regressions

---

## Appendix A — Curated Model List (initial registry)

| Alias | Model ID | Mode | Structured Outputs | Pricing (in/out per 1M) |
|---|---|---|---|---|
| `default-chat` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | chat | yes | $0.88/$0.88 |
| `fast-chat` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | chat | no | $0.18/$0.18 |
| `json-structured` | `Qwen/Qwen2.5-72B-Instruct-Turbo` | chat | yes | $0.60/$0.60 |
| `reasoning-premium` | `deepseek-ai/DeepSeek-R1` | chat | yes | $3.00/$7.00 |
| `vision-primary` | `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | vision | yes | $0.27/$0.85 |
| `embedding-default` | `togethercomputer/m2-bert-80M-8k-retrieval` | embedding | n/a | $0.02/$0.02 |

The allowlist in `config/models.ts` is replaced by the registry's `status: 'active'` entries. `primary-model` and `secondary-model` placeholder strings are removed; callers must use real model IDs or aliases.

---

## Files Changed

| File | Change |
|---|---|
| `packages/backend/package.json` | add `together-ai`, `zod-to-json-schema` dependencies |
| `packages/backend/src/lib/agent-fabric/TogetherClient.ts` | new — SDK singleton |
| `packages/backend/src/lib/agent-fabric/ModelRegistry.ts` | new — curated registry + alias resolver |
| `packages/backend/src/lib/agent-fabric/LLMGateway.ts` | replace fetch with SDK; add `responseSchema` to `LLMRequest`; wire structured outputs |
| `packages/backend/src/lib/agent-fabric/llm-types.ts` | add `responseSchema?: Record<string, unknown>` to `LLMConfig` |
| `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | derive JSON schema from Zod in `secureInvoke`; pass as `responseSchema` |
| `packages/backend/src/services/middleware/EmbeddingService.ts` | replace fetch with SDK |
| `packages/backend/src/services/llm/LLMCostTracker.ts` | update pricing table |
| `packages/backend/src/config/models.ts` | delegate to `ModelRegistry`; remove hardcoded array |
| `packages/backend/src/config/env-validation.ts` | add `TOGETHER_API_BASE_URL`, `TOGETHER_TIMEOUT_MS` |
| `.env.example` | document Together env vars |
