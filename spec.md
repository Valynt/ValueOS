# ValueOS Production Finish Line — Specification

## Problem Statement

ValueOS has a substantial, well-architected backend with real agent implementations, a working economic kernel, a saga-based lifecycle orchestrator, and live LLM integration via Together.ai. However, the platform is not yet production-complete because of a set of specific, concrete gaps that prevent end-to-end operation:

1. **Frontend agents are mocked.** The `useAgent` hook in `apps/ValyntApp/src/features/agents/hooks/useAgent.ts` has a hardcoded `AGENT_PREVIEW_MODE` guard that returns a simulated streaming response instead of calling the backend. Users see fake agent output.

2. **AgentFabricService returns static data.** `packages/backend/src/services/post-v1/AgentFabricService.ts` `buildAgentFabricResult()` returns hardcoded values (`roi_percentage: 15`, `npv_amount: 1500000`, `payback_months: 12`) regardless of input. This is the service wired to the canvas value case generation flow.

3. **Critical services are gated as post-v1.** `CallAnalysisService`, `EmailAnalysisService`, `WebScraperService`, `PromptVersionControl`, `RealizationFeedbackLoop`, and `BenchmarkService` are all in `POST_V1_SERVICES` and disabled at startup. These are required for the full context assembly and realization loop.

4. **The FallbackAIService is pattern-matching theater.** When the LLM is unavailable, the fallback returns keyword-matched static strings rather than a proper degraded state. This masks failures.

5. **The HypothesisGenerator uses heuristic impact estimation.** `estimateImpactMin/Max` are simple multipliers (`signalStrength * 5`, `signalStrength * 15 + 10`) with no LLM reasoning or benchmark grounding. The generator does not call the LLM.

6. **The ValueLifecycleOrchestrator's `runLifecycle` only chains opportunity→target.** The full saga (INITIATED→DRAFTING→VALIDATING→COMPOSING→REFINING→FINALIZED) is defined but `runLifecycle` only executes two stages. The `runHypothesisLoop` method exists but is not wired to the primary API surface.

7. **The CaseWorkspace wizard uses a static VALUE_MODELS catalogue.** The new-case wizard in `apps/ValyntApp/src/pages/valueos/CaseWorkspace.tsx` presents hardcoded model options and does not trigger the agent lifecycle on creation.

8. **CallAnalysis, EmailAnalysis, and WebScraper are post-v1 but required.** CRM + call transcription + web research are the three required integration sources. All three are currently disabled.

9. **The RealizationDashboard uses hardcoded fixture data.** `apps/ValyntApp/src/features/workflow/components/RealizationDashboard.tsx` renders static variance data (`predicted: 20, actual: 18`) rather than fetching from the realization agent output.

10. **PromptVersionControl is post-v1.** Prompt versioning and A/B testing infrastructure exists but is disabled, meaning prompt changes are untracked and unauditable in production.

11. **The `ENABLE_AGENT_PLACEHOLDER_MODE` flag defaults to `true` in non-production.** This means staging environments run with fake agent execution unless explicitly overridden.

12. **The `ENABLE_DOMAIN_PACK_CONTEXT` flag defaults to `false`.** Domain pack KPI context loading in agents is disabled, meaning agents do not receive industry-specific KPI priors.

13. **The `BenchmarkService` is post-v1.** The `HypothesisGenerator` queries the `benchmarks` table directly but the `BenchmarkService` (which provides p25/p50/p75/p90 distributions and persona-specific KPI retrieval) is disabled. Benchmark validation in hypothesis generation is therefore incomplete.

14. **The `RealizationFeedbackLoop` is post-v1.** Post-sale value tracking and variance-triggered agent retraining are disabled. The realization phase has no feedback mechanism.

15. **The `IntegrityAgentService` is post-v1.** The `IntegrityAgent` (fabric agent) exists and is wired into the lifecycle, but the `IntegrityAgentService` (which handles quiz grading and lab evaluation for the Academy) is disabled. This is a secondary concern but blocks the Academy feature.

---

## Requirements

### R1 — Remove All Mock/Stub Agent Paths

- Delete the `AGENT_PREVIEW_MODE` guard in `useAgent.ts`. The hook must call `/api/agents/:agentId/invoke` for all agent interactions.
- Replace `AgentFabricService.buildAgentFabricResult()` with a real invocation of the `ValueLifecycleOrchestrator.runHypothesisLoop()`. The canvas value case generation must produce LLM-derived outputs.
- Remove or replace `FallbackAIService.generateFallbackAnalysis()` pattern-matching logic with a proper error state that surfaces the failure reason to the caller. Budget-limit fallback (the simple string response) is acceptable; keyword-matched fake analysis is not.
- Set `ENABLE_AGENT_PLACEHOLDER_MODE` default to `false` in all environments.

### R2 — Wire the Full Hypothesis Loop to the Primary API

- The `/api/agents/:agentId/invoke` endpoint currently supports direct fabric agent execution. Add a `/api/cases/:caseId/run-hypothesis-loop` endpoint (or equivalent) that invokes `ValueLifecycleOrchestrator.runHypothesisLoop()` end-to-end.
- The `runLifecycle` method must be extended (or replaced by `runHypothesisLoop`) to execute all six saga stages: INITIATED→DRAFTING→VALIDATING→COMPOSING→REFINING→FINALIZED.
- The `HypothesisGenerator` must call the LLM (via `LLMGateway`) to generate hypothesis descriptions and impact estimates rather than using heuristic multipliers. Benchmark plausibility checks must use `BenchmarkService` (once promoted to v1).

### R3 — Promote Post-v1 Services to v1

Move the following from `POST_V1_SERVICES` to `V1_SERVICES` in `v1-service-scope.ts` and ensure they are initialized at startup:

- `CallAnalysisService` — required for call transcript ingestion in `DealAssemblyAgent`
- `EmailAnalysisService` — required for email thread context in deal assembly
- `WebScraperService` — required for web research in `DealAssemblyAgent`
- `BenchmarkService` — required for hypothesis plausibility validation
- `RealizationFeedbackLoop` — required for post-sale variance tracking
- `PromptVersionControl` — required for auditable prompt management in production
- `IntegrityAgentService` — required for Academy lab evaluation

### R4 — Wire CRM + Call + Web Research into Deal Assembly

- `DealAssemblyAgent` already has CRM and SEC EDGAR wiring. Add call transcript ingestion: when `transcript_ids` are provided in the assembly request, fetch transcripts, run `CallAnalysisService.analyzeTranscript()`, and merge the resulting pain points, objections, and stakeholders into the `DealContext`.
- Add web research: when a `company_domain` is present, run `WebScraperService` to fetch public company context and merge it as `externally-researched` source fragments.
- The `DealAssemblyService` must surface which sources were consulted and what was found/missing in the assembly summary.

### R5 — Wire the CaseWorkspace to the Agent Lifecycle

- The new-case wizard in `CaseWorkspace.tsx` must trigger `DealAssemblyAgent` on creation (when a CRM opportunity is linked) or `OpportunityAgent` (when starting from scratch).
- Remove the static `VALUE_MODELS` catalogue. Model selection should be driven by domain packs or agent-suggested value drivers, not a hardcoded list.
- Enable `ENABLE_DOMAIN_PACK_CONTEXT` by default. Agents must receive domain pack KPI context when a pack is assigned to the case.

### R6 — Wire the RealizationDashboard to Real Data

- `RealizationDashboard.tsx` must fetch realization data from the `RealizationAgent` output stored in `RealizationReportRepository`, not from hardcoded fixture state.
- The dashboard must display actual vs. committed KPI values, variance direction, and intervention recommendations from the `RealizationFeedbackLoop`.

### R7 — Enable PromptVersionControl in Production

- All agent prompts must be registered in the `PromptRegistry` with version, owner, ticket, and risk class metadata.
- Prompt activations in production must require approval metadata (`owner`, `ticket`, `risk_class`).
- `PromptVersionControl` must be initialized at startup and wired to the `LLMGateway` so every LLM call records which prompt version was used.

### R8 — Production Hardening

- `ENABLE_AGENT_PLACEHOLDER_MODE` must default to `false` in all environments (currently defaults to `true` in non-production).
- `ENABLE_DOMAIN_PACK_CONTEXT` must default to `true`.
- `ENABLE_ASYNC_AGENT_EXECUTION` must be evaluated and enabled where appropriate (currently defaults to `false`).
- The `AgentFabricService` in `post-v1/` must either be deleted or replaced with a real implementation. It must not remain as a static data generator.
- The `RealizationFeedbackLoop` must be initialized and connected to the `RealizationAgent` output path so variance is recorded automatically after each realization stage execution.

---

## Acceptance Criteria

1. A new value case can be created from a CRM opportunity, triggering `DealAssemblyAgent` which fetches CRM data, call transcripts (if provided), and web research, and produces a populated `DealContext` with no manual data entry.
2. The `OpportunityAgent` generates value hypotheses using real LLM calls. Hypotheses include estimated impact ranges grounded against `BenchmarkService` p25/p75 distributions.
3. The full saga (INITIATED→DRAFTING→VALIDATING→COMPOSING→REFINING→FINALIZED) executes end-to-end for a value case, with each stage producing persisted, auditable output.
4. The `IntegrityAgent` produces a pass/veto decision with per-claim validation results backed by LLM reasoning. A veto blocks progression to COMPOSING.
5. The `NarrativeAgent` produces an executive narrative with a defense readiness score. The narrative is persisted to `narrative_drafts` and retrievable via the API.
6. The `RealizationAgent` compares committed KPI targets against actual telemetry and produces variance reports. The `RealizationFeedbackLoop` records outcomes and triggers recommendations.
7. The `RealizationDashboard` displays live data from the realization agent, not fixture data.
8. The `useAgent` hook calls the real backend for all agent interactions. No `AGENT_PREVIEW_MODE` guard exists in production code.
9. `AgentFabricService.generateValueCase()` invokes the real hypothesis loop and returns LLM-derived outputs.
10. `CallAnalysisService`, `WebScraperService`, `BenchmarkService`, `RealizationFeedbackLoop`, and `PromptVersionControl` are initialized at startup and operational.
11. Every LLM call records the prompt version used. Prompt activations in production require approval metadata.
12. `ENABLE_AGENT_PLACEHOLDER_MODE` is `false` in all environments. `ENABLE_DOMAIN_PACK_CONTEXT` is `true` by default.
13. All agent outputs include `reasoning`, `assumptions`, `evidence_sources`, `confidence_level`, and `formula_trace` where applicable. No black-box numbers without provenance.
14. The platform passes a full end-to-end test: opportunity context → hypothesis generation → financial modeling → integrity validation → narrative generation → realization tracking, with no broken flows, no mock data, and no manual rescue steps.

---

## Implementation Approach

The following is an ordered list of implementation tasks. Each task is a discrete, shippable unit of work.

### Phase 1 — Remove Mock Paths and Harden Feature Flags

1. **Delete `AGENT_PREVIEW_MODE` guard in `useAgent.ts`** (`apps/ValyntApp/src/features/agents/hooks/useAgent.ts`). Replace the simulated streaming loop with a real call to `apiClient.post('/api/agents/:agentId/invoke', ...)`. Wire the response to the existing message state. Handle errors with a proper error state, not a fake response.

2. **Replace `AgentFabricService.buildAgentFabricResult()` with real execution** (`packages/backend/src/services/post-v1/AgentFabricService.ts`). The `generateValueCase()` method must instantiate `ValueLifecycleOrchestrator` and call `runHypothesisLoop()`. Remove all hardcoded financial model values.

3. **Set `ENABLE_AGENT_PLACEHOLDER_MODE` default to `false`** in `featureFlags.ts`. Remove the `process.env.NODE_ENV !== 'production'` conditional. The flag must be explicitly set to `true` only in test environments via env var.

4. **Set `ENABLE_DOMAIN_PACK_CONTEXT` default to `true`** in `featureFlags.ts`.

5. **Replace `FallbackAIService.generateFallbackAnalysis()` pattern-matching** with a structured error response that includes the failure reason, a `degraded: true` flag, and no fake hypotheses or metrics.

### Phase 2 — Promote Post-v1 Services to v1

6. **Move `CallAnalysisService`, `EmailAnalysisService`, `WebScraperService`, `BenchmarkService`, `RealizationFeedbackLoop`, `PromptVersionControl`, `IntegrityAgentService` from `POST_V1_SERVICES` to `V1_SERVICES`** in `v1-service-scope.ts`. Ensure each is initialized in `server.ts` startup sequence.

7. **Wire `PromptVersionControl` to `LLMGateway`**. Every `LLMGateway.complete()` call must record the prompt version reference in the request metadata. Add a `promptVersionRef` field to `LLMRequestMetadata`.

8. **Initialize `RealizationFeedbackLoop` in the realization stage handler**. After `RealizationAgent.execute()` completes, call `FeedbackLoopService.recordOutcome()` with the agent's proof points and variance data.

### Phase 3 — Wire the Full Hypothesis Loop

9. **Extend `runLifecycle()` to execute all six saga stages** in `ValueLifecycleOrchestrator.ts`. The current implementation only chains opportunity→target. Add integrity, narrative, and realization stages. Each stage must use the saga state machine transitions (INITIATED→DRAFTING→VALIDATING→COMPOSING→REFINING→FINALIZED).

10. **Add `POST /api/cases/:caseId/run-hypothesis-loop` endpoint** in `packages/backend/src/api/dealAssembly.ts` (or a new `lifecycle.ts` route). This endpoint must accept a `LifecycleContext`, invoke `ValueLifecycleOrchestrator.runHypothesisLoop()`, and return the saga final state and output artifacts.

11. **Replace `HypothesisGenerator` heuristic impact estimation with LLM reasoning**. The `generate()` method must call `LLMGateway.complete()` with a structured prompt that takes the value driver candidates and produces estimated impact ranges with reasoning. The LLM output must be validated against `BenchmarkService` p25/p75 distributions.

### Phase 4 — Wire CRM + Call + Web Research into Deal Assembly

12. **Add call transcript ingestion to `DealAssemblyAgent`**. When `transcript_ids` are present in the `LifecycleContext`, fetch each transcript from the database, call `CallAnalysisService.analyzeTranscript()`, and merge pain points, objections, stakeholders, and buying signals into the `DealContext` as `call-derived` source fragments.

13. **Add web research to `DealAssemblyAgent`**. When `company_domain` is present, call `WebScraperService.scrape()` for the company's public web presence and merge the result as `externally-researched` source fragments. This supplements the existing SEC EDGAR integration.

14. **Update `DealAssemblyService`** to pass `transcript_ids` and `company_domain` from the assembly request through to `DealAssemblyAgent`.

### Phase 5 — Wire the CaseWorkspace to the Agent Lifecycle

15. **Replace the static `VALUE_MODELS` catalogue in `CaseWorkspace.tsx`** with a call to the domain pack API or the `OpportunityAgent` to suggest value drivers. On case creation, trigger `DealAssemblyAgent` (if CRM opportunity linked) or `OpportunityAgent` (if starting from scratch) via the `/api/cases/:caseId/run-hypothesis-loop` endpoint.

16. **Wire `RealizationDashboard.tsx` to real data**. Replace the hardcoded `useState` fixture with a `useEffect` that fetches from `GET /api/cases/:caseId/realization` (backed by `RealizationReportRepository`). Display actual vs. committed KPIs, variance, and intervention recommendations.

### Phase 6 — Observability and Production Hardening

17. **Ensure all agent outputs include provenance fields**. Audit `OpportunityAgent`, `FinancialModelingAgent`, `IntegrityAgent`, `NarrativeAgent`, `RealizationAgent`, and `ExpansionAgent` output schemas. Each must include: `reasoning_trace`, `assumptions_used`, `evidence_sources`, `confidence_level`, and (for financial outputs) `formula_trace`. Add missing fields where absent.

18. **Wire `valueLoopMetrics` to the hypothesis loop execution path**. The `stageTransitionLatency`, `agentInvocations`, `hypothesisConfidence`, and `financialCalculations` metrics must be recorded at each stage of `runHypothesisLoop()`.

19. **Validate `ENABLE_ASYNC_AGENT_EXECUTION`**. Evaluate whether async execution (BullMQ) should be enabled for the hypothesis loop. If enabled, ensure the frontend polls for job completion via the existing job status endpoint. Document the decision.

20. **Run the full end-to-end test suite** (`pnpm run test:e2e`) and fix any failures introduced by the above changes. Ensure the lint warning ceiling in `BURN-DOWN.md` is not exceeded.
