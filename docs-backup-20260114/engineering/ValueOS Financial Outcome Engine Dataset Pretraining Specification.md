# ValueOS Financial-Outcome Engine Dataset & Pretraining (VOS-PT-1) Specification

This document defines the technical architecture, data schemas, and pre-training requirements for the **ValueOS VOS-PT-1 Dataset**. This dataset is designed to transform a generic Large Language Model (LLM) into a **Financial-Outcome Engine** capable of expert-level value engineering, ROI modeling, and executive-level economic storytelling.

---

## 1. VOS-PT-1 Dataset Architecture Overview

The VOS-PT-1 specification targets the cognitive gap between "business chat" and "financial reasoning." It prioritizes structural integrity over raw volume, focusing on five high-leverage data domains.

| Dataset Component | Objective | Primary Schema Base |
| :--- | :--- | :--- |
| **Value Reasoning Traces** | Encode logical "Pain-to-Impact" chains. | VMRT v1.0.0 |
| **Persona & Industry Maps** | Connect stakeholders to EBITDA drivers. | ESO (Economic Structure Ontology) |
| **Lifecycle Reasoning** | Orchestrate Discovery → ROI → Expansion. | Customer Lifecycle Logic |
| **Financial Ground Truth** | Eliminate hallucination with benchmarks. | Ground Truth Library |
| **Narrative & Explanation** | Translate formulas into executive stories. | Executive Narrative Data |

---

## 2. Technical Schemas & Data Specs

### 2.1 Value Modeling Reasoning Traces (VMRT)
VMRTs are the "Chain-of-Thought" samples that teach the model how to navigate from a qualitative pain point to a quantified financial outcome.

**Trace Structure Requirements:**
1. **Pain Identification:** Root cause of operational friction.
2. **Capability Mapping:** Specific software/process solution.
3. **KPI Pivot:** The bridge metric (e.g., Days-to-Close).
4. **Financial Logic:** Mathematical derivation of value (Cost vs. Revenue vs. Risk).

```json
{
  "trace_type": "VMRT_COGNITIVE_CHAIN",
  "reasoning_steps": [
    {
      "step": "problem_identification",
      "logic": "High process variability in monthly close (8 days vs. 3 day benchmark)."
    },
    {
      "step": "impact_calculation",
      "formula": "(Current_Days - Target_Days) * (FTE_Count * Daily_Rate)",
      "variables": {
        "FTE_Count": 12,
        "Daily_Rate": 520,
        "Delta": 5
      },
      "output_usd": 31200
    }
  ],
  "outcome_category": "cost_savings"
}
```

### 2.2 Persona & Industry Value Maps
This layer ensures the model understands the *Economic Interest* of a stakeholder. It maps roles to specific financial levers.

**Mapping Logic Table:**
| Persona | Primary Pain | Key Performance Indicator (KPI) | Financial Driver (EBITDA Impact) |
| :--- | :--- | :--- | :--- |
| **VP Sales** | Pipeline Volatility | Win Rate / Quota Attainment | Revenue Uplift |
| **CFO** | Working Capital Friction | Days Sales Outstanding (DSO) | Free Cash Flow (FCF) |
| **CIO** | Technical Debt | Maintenance Ratio | OpEx Reduction |
| **VP Ops** | Asset Downtime | OEE (Overall Equipment Effectiveness) | COGS Optimization |

### 2.3 Lifecycle Reasoning Traces
These traces teach the model how value evolves throughout the SaaS customer journey.

*   **Discovery Stage:** Mapping prospect "complaints" to **Root Problem Classes**.
*   **ROI Modeling Stage:** Building the **Business Case** based on discovered constraints.
*   **QBR/Realization Stage:** Comparing **Committed vs. Realized** value and identifying "Adoption Lags."
*   **Expansion Stage:** Identifying **Incremental ROI** paths for upsell/cross-sell.

### 2.4 Financial Ground Truth (FGT)
The FGT dataset acts as the model's "Integrity Agent," providing hard constraints on industry benchmarks to prevent unrealistic ROI projections.

**FGT Data Points (Authoritative Sources: APQC, NRF, BLS):**
*   **Labor Rates:** Fully loaded FTE costs by region and role.
*   **Process Benchmarks:** Median costs for AP Invoicing ($5.83), HR Onboarding, or IT Ticket Resolution.
*   **SaaS Metrics:** NRR (104% median), CAC Payback (14 months), and Rule of 40 distributions.

---

## 3. VOS-PT-1 Pretraining Set Specification

The VOS-PT-1 set is a curated collection of 15,000–20,000 high-quality reasoning pairs and structured facts.

### 3.1 Data Distribution Logic
To achieve GPT-4 level economic reasoning, the training distribution is weighted toward **Reasoning Traces** rather than raw facts.

| Data Category | Target Volume | Weighting | Source Type |
| :--- | :--- | :--- | :--- |
| **VMRT (Reasoning Traces)** | 5,000 Traces | 40% | Human-Expert Generated |
| **ESO (KPI Ontology)** | 2,500 Nodes | 15% | Structured Schema |
| **Ground Truth Library** | 1,500 Benchmarks | 10% | Verified Economic Data |
| **Executive Narratives** | 3,000 Stories | 20% | SEC Filings / Case Studies |
| **Objection-Handling Traces** | 3,000 Pairs | 15% | Sales/CS Simulation |

### 3.2 Pre-training Validation Logic
Every token sequence in VOS-PT-1 must pass the **Financial Consistency Check (FCC)**:

1. **Logical Closure:** Does the KPI delta mathematically lead to the stated USD impact?
2. **Benchmark Alignment:** Is the projected improvement within the 75th percentile of industry benchmarks? (Flag if >90th percentile).
3. **Persona Consistency:** Does the narrative align with the stated stakeholder's strategic priorities?
4. **Unit Integrity:** Are all units (USD, FTE, Percent, Days) maintained consistently throughout the reasoning chain?

---

## 4. Narrative & Explanation Data (Executive Storytelling)

ValueOS must communicate in the language of the Boardroom. This dataset transforms raw data into **Strategic Alignment Framing**.

**Transformation Pattern:**
*   *Input:* "Reducing AP processing time by 30% saves $200k."
*   *VOS-PT-1 Output:* "By automating reconciliation, the finance organization reallocates 2,400 hours from administrative processing to strategic analysis, accelerating the CFO's transition toward predictive cash flow planning."

---

## 5. Strategic Implementation Guidelines

To deploy the VOS-PT-1 specification successfully, the following "Guardrails" are enforced:

1. **No Hallucinated Numbers:** If a benchmark is unknown, the model must trigger a `GroundTruthLookup` rather than generating a number.
2. **Evidence-Based Logic:** Every USD claim must be supported by a minimum of one reasoning step in the VMRT.
3. **Sensitivity Awareness:** All ROI models must include a "Conservative vs. Optimistic" range based on variable confidence scores.

### 6. Success Metrics for PT-1 Fine-Tuning
*   **Reasoning Accuracy:** >95% accuracy in multi-step financial calculations.
*   **Persona Relevance:** >90% alignment between stakeholder pain and proposed value drivers.
*   **Hallucination Rate:** <1% on industry-standard labor and process benchmarks.

---
**Document Status:** Final Specification  
**Reference ID:** VOS-DATA-SPEC-V1  
**Authoritative Schema:** ValueOS Master Schema / Economic Structure Ontology (ESO)