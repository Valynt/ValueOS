# Proposal: Value Modeling Engine

## Intent

Wire the hypothesis-to-scenario workflow end-to-end: from auto-generated value hypotheses through baseline establishment, assumption management, and three-scenario financial modeling with sensitivity analysis.

## Scope

In scope:
- Value hypothesis generation from DealContext signals
- Baseline metric establishment (customer-confirmed > benchmark-derived > inferred)
- Assumption register with source tagging
- Conservative / base / upside scenario modeling via economic kernel
- Sensitivity analysis
- EVF decomposition (revenue, cost, risk, efficiency)
- Recalculation on upstream changes

Out of scope:
- Custom financial model templates (V2)
- Multi-currency support (V2)
- Monte Carlo simulation (V2)

## Approach

The economic kernel (`packages/backend/src/domain/economic-kernel/`) already implements DCF, NPV, IRR, payback, and sensitivity analysis. The `FinancialModelingAgent` exists but needs to be wired to consume DealContext, produce structured hypotheses, and persist scenarios. The `TargetAgent` already produces value drivers but doesn't persist to `value_tree_nodes`. Close these gaps.
