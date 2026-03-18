# Design: Value Modeling Engine

## Technical Approach

Extend the existing `FinancialModelingAgent` and `TargetAgent` to consume `DealContext` and persist structured outputs. All arithmetic uses the deterministic economic kernel — no LLM-generated math.

## Architecture Decisions

### Decision: Deterministic economic kernel for all calculations

LLMs propose hypotheses, assumptions, and narratives. The economic kernel computes all financial figures. This prevents math hallucinations and ensures reproducibility.

### Decision: Assumption register as first-class table

Assumptions are currently inline in agent outputs. Promoting them to a dedicated table with source tags, confidence scores, and benchmark references enables audit, override tracking, and recalculation triggers.

### Decision: Three-scenario output as standard

Every completed financial model produces conservative, base, and upside scenarios. Scenarios differ by assumption values, not by structure.

## Data Flow

```
DealContext ──► TargetAgent ──► ValueHypotheses + ValueDrivers
                                        │
                                        ▼
                              FinancialModelingAgent
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              Conservative           Base              Upside
               Scenario            Scenario            Scenario
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                              Economic Kernel
                          (ROI, NPV, Payback, EVF)
                                        │
                                        ▼
                              Sensitivity Analysis
```

## File Changes

### New
- `packages/backend/src/services/modeling/HypothesisGenerator.ts` — Generate value hypotheses from DealContext
- `packages/backend/src/services/modeling/BaselineEstablisher.ts` — Establish baselines from customer data, benchmarks, or inference
- `packages/backend/src/services/modeling/AssumptionRegister.ts` — CRUD for assumptions with source tags
- `packages/backend/src/services/modeling/ScenarioBuilder.ts` — Build three scenarios from assumptions
- `infra/supabase/supabase/migrations/YYYYMMDD_assumptions_and_scenarios.sql` — assumptions, scenarios tables

### Modified
- `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts` — Persist value drivers to `value_tree_nodes`
- `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts` — Consume DealContext, produce three scenarios
- `packages/backend/src/domain/economic-kernel/economic_kernel.ts` — Add EVF decomposition helper
- `packages/backend/src/services/workflows/WorkflowDAGDefinitions.ts` — Add modeling DAG steps
