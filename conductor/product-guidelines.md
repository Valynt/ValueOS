# Product Guidelines: ValueOS

## The CFO Defence Test
Every output must pass the ultimate qualitative gate:
> **"Can a senior Value Engineer walk into a boardroom and defend a $10M claim using the ValueOS output without hand-waving or manual spreadsheet verification?"**

## Red Flag Kill Criteria
Immediate "No-Go" for production if:
1. **Hidden Confidence**: Any financial claim presented without a confidence score or citation.
2. **Silent Invalidation**: Upstream variable changes not triggering downstream re-validation.
3. **Math Hallucinations**: Discrepancy between LLM narrative and programmatic calculations.
4. **Security Leakage**: RLS failure allowing cross-tenant data access.

## Integrity Engine Principles
- **Evidence Tiering**:
    - **Tier 1**: Primary/Public data (EDGAR, 10-K).
    - **Tier 2**: Market/Secondary research.
    - **Tier 3**: Proprietary Benchmarks.
- **Veto Logic**: The `IntegrityAgent` provides component-scoped vetoes.
- **Confidence Scoring**: Based on Data Freshness, Source Reliability, and Logic Transparency.

## CFO-Defensible Lineage
Every calculated figure must be "explorable." Clicking a number must reveal its **Lineage**:
- Raw data source.
- Formula used.
- Agent responsible for calculation.
