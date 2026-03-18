---
name: code-review
description: Review code changes in ValueOS against project standards. Use when asked to review a PR, review a diff, check code quality, or audit changes before merging. Covers tenant isolation, TypeScript strictness, agent conventions, security, and test coverage.
---

# Code Review

Review changes against ValueOS standards. Work through each checklist section in order — stop and flag blockers before continuing.

## Checklist

### 1. Tenant isolation (blocker)
- Every new Supabase query includes `.eq("organization_id", orgId)` or `.eq("tenant_id", tenantId)`
- Every vector/memory query filters on `tenant_id` in metadata
- No `service_role` client used outside AuthService, tenant provisioning, or cron jobs
- Cross-tenant data transfer is impossible in the new code paths

### 2. TypeScript strictness (blocker)
- No new `any` — use `unknown` + type guards or specific interfaces
- No `(req as any)` casts — new request properties go in `express.d.ts`
- No default exports — named exports only
- Zod schemas used for all runtime-validated inputs

### 3. Agent conventions (if touching agent code)
- Agent extends `BaseAgent`, defines `lifecycleStage`, `version`, `name`
- LLM calls use `this.secureInvoke(...)` — no direct `llmGateway.complete()`
- Memory stored with `this.organizationId` (not hardcoded tenant)
- Zod schema includes `hallucination_check: boolean`
- Prompts use Handlebars templates, not string concatenation
- Confidence thresholds match risk level (financial 0.7–0.9, commitment 0.6–0.85, discovery 0.5–0.8)

### 4. Security
- No PII logged (SSN, CC, email lists, phone, passport, DOB, healthcare IDs)
- No secrets or API keys hardcoded or committed
- Dangerous commands not introduced (DROP/TRUNCATE without WHERE, `rm -rf`, `eval`, `kill -9`)
- Audit trail present for create/update/delete/export/approve/reject/grant/revoke actions

### 5. Test coverage
- New agent logic has a corresponding test mocking `LLMGateway` and `MemorySystem`
- New DB queries have RLS coverage (`pnpm run test:rls`)
- New API endpoints have at least a happy-path test
- Tests are co-located (`*.test.ts` / `*.spec.ts`) and use Vitest globals

### 6. Code quality
- Service files that grew past ~1000 lines have cohesive sub-concerns extracted
- No duplicate service files without documented distinction in file headers and `debt.md`
- SDUI components registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`
- Tools implement `Tool<TInput, TOutput>` and are registered statically in `ToolRegistry.ts`

### 7. Context layer maintenance
- If a new DB table, endpoint, hook, or UI component was added → `traceability.md` updated
- If an architectural decision was made → `decisions.md` updated
- If debt was resolved → `debt.md` updated
- If a non-obvious problem was solved → `memory.md` updated

## Output format

For each section, report one of:
- ✅ — passes
- ⚠️ — concern worth noting but not a blocker
- ❌ — blocker; must be fixed before merge

End with a summary: overall verdict (approve / request changes / needs discussion) and the top 3 action items if any.

## Anti-patterns

- Do not approve code with missing tenant isolation — this is a data leak
- Do not approve new `any` usages that push a package over its ratchet ceiling
- Do not skip the agent conventions section when agent files are in the diff
- Do not flag style preferences as blockers — only flag rule violations
