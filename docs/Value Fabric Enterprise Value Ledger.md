# Value Fabric: Single Source of Truth for Enterprise Value

## 1. Architectural Overview

The **Value Fabric** is the immutable, semantic ledger of the ValueOS platform. While the **Agent Fabric** acts as the cognitive reasoning engine (the "writer"), the Value Fabric serves as the persistent system of record (the "ledger"). It transforms ephemeral AI reasoning into enduring enterprise assets: Value Trees, ROI Models, System Maps, and Proof Points.

Unlike traditional CRMs that store static text fields (e.g., "Expected Revenue"), the Value Fabric stores **Computational Value Graphs**. Every data point is a node in a causal network, linked by mathematical edges defined in the **Systemic Outcome Framework (SOF)**. This ensures that a change in an operational metric (e.g., *Manufacturing OEE*) automatically propagates to financial outcomes (e.g., *Gross Margin*) based on strictly governed logic.

![Value Fabric Data Model](https://r2.flowith.net/files/jpeg/OAKNO-value_fabric_data_model_index_3@1024x1024.jpeg)

### 1.1 Core Responsibilities
*   **Semantic Consistency:** Enforces a unified ontology across Sales, Customer Success, and Product teams. A "Lead" or "Churn Event" is defined mathematically once and referenced globally.
*   **Causal Integrity:** Prohibits "orphan" value claims. Every financial projection must trace back to an operational root cause via a valid reasoning chain (VMRT).
*   **Versioned Truth:** Implements "Time-Travel" capabilities, allowing the enterprise to audit how value definitions and baseline assumptions evolve over the customer lifecycle.

---

## 2. Core Data Structures

The Value Fabric is composed of four atomic data structures that organize unstructured business context into queryable economic intelligence.

### 2.1 The Value Modeling Reasoning Trace (VMRT)
The VMRT is the fundamental unit of storage. It captures not just the *result* of a calculation, but the entire cognitive chain used to arrive at it. This allows the system to defend its logic during audits.

**Schema Definition (JSON Schema Excerpt):**
The VMRT standardizes how agents persist reasoning. It enforces the inclusion of evidence, confidence intervals, and step-by-step logic.

```json
{
  "$id": "https://valueos.ai/schemas/value-modeling-reasoning-trace/v1.0.0",
  "title": "Value Modeling Reasoning Trace (Atomic Unit)",
  "required": ["trace_id", "reasoning_steps", "value_model", "evidence"],
  "properties": {
    "trace_id": { "type": "string", "pattern": "^VMRT-[0-9]{4}-[A-Z0-9]{6}$" },
    "context": {
      "organization": { "industry": "Manufacturing", "tier": "enterprise" },
      "constraints": { "budget_usd": 500000, "min_roi": 1.5 }
    },
    "reasoning_steps": {
      "type": "array",
      "items": {
        "step_type": "impact_calculation",
        "description": "Calculate labor savings from automation",
        "logic": {
          "formula": "annual_cost = volume * cost_per_invoice",
          "assumptions": [
            { "assumption": "Manual cost is $12.50", "basis": "APQC Benchmark", "confidence": 0.9 }
          ]
        },
        "output": { "value": 600000, "unit": "USD" }
      }
    },
    "value_model": {
      "financial_impact": {
        "revenue_uplift": { "type": "number" },
        "cost_savings": { "type": "number" },
        "risk_mitigation": { "type": "number" }
      }
    }
  }
}
```

### 2.2 The Value Tree Hierarchy
Value Trees provide the navigational structure for the fabric, linking high-level executive goals to low-level technical capabilities.

| Hierarchy Level | Definition | Example | Owner |
| :--- | :--- | :--- | :--- |
| **L1: Objective** | Strategic goal of the C-Suite. | "Maximize Free Cash Flow" | CFO |
| **L2: Value Driver** | Functional lever impacting the objective. | "Reduce Operating Expenses" | VP Ops |
| **L3: Outcome** | Measurable business result. | "Decrease Invoice Processing Cost" | Director of Finance |
| **L4: Capability** | Technical intervention enabling the outcome. | "Automated OCR Extraction" | Product User |
| **L5: KPI** | The metric measuring progress. | `finance_ap_invoice_cost` | Data Analyst |

### 2.3 Proof Points & Evidence
The Fabric distinguishes between *Hypothetical Value* (Pre-Sales) and *Realized Value* (Post-Sales). Proof Points are stored as immutable records linking a committed outcome to telemetry data.

*   **Structure:** `ProofPoint { commitment_id, realized_value, verification_source, timestamp }`
*   **Verification:** Validated by the `RealizationAgent` against connected data streams (e.g., Salesforce, ERP, Usage Logs).

---

## 3. Schemas & Ontologies: The Knowledge Graph

The brain of the Value Fabric is the **Economic Structure Ontology (ESO)**. This graph database defines over 500 industry-standard KPIs and their mathematical dependencies, ingested from the **Ground Truth Library**.

### 3.1 The ESO Graph (Economic Structure Ontology)
The ESO allows the system to perform "Reasoning Traces." It knows that improving `mfg_oee` (Overall Equipment Effectiveness) mathematically necessitates an increase in `mfg_throughput`.

**YAML Graph Definition (ESO Excerpt):**

```yaml
# Economic Structure Ontology - Dependency Graph
nodes:
  - id: "mfg_oee"
    name: "Overall Equipment Effectiveness"
    domain: "Manufacturing"
    unit: "percentage"
    benchmarks: { p50: 60.0, world_class: 85.0 }
    
  - id: "mfg_throughput"
    name: "Manufacturing Throughput"
    formula_string: "theoretical_max_output * mfg_oee"
    dependencies: ["mfg_oee"]

  - id: "saas_nrr"
    name: "Net Revenue Retention"
    domain: "SaaS"
    formula_string: "(starting_arr + expansion - churn) / starting_arr"
    dependencies: ["saas_logo_churn_annual", "saas_expansion_revenue"]

edges:
  - source: "mfg_oee"
    target: "mfg_throughput"
    type: "causal_driver"
    logic: "linear_correlation"
    
  - source: "ret_shrinkage"
    target: "ret_gross_margin"
    type: "inverse_subtraction"
    description: "Shrinkage directly reduces Gross Margin."
```

### 3.2 Ground Truth Integration
The Fabric ingests static benchmarks to validate dynamic models. If an agent proposes a "0% Churn Rate," the IntegrityAgent queries the Ground Truth Library to flag this as a hallucination based on industry standards.

**Benchmark Data Table (2020-2025):**

| Metric ID | Industry | Unit | P25 (Lagging) | P50 (Median) | P75 (Leading) | Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fin_dso` | Finance | Days | 48.0 | 38.0 | 30.0 | APQC (2023) |
| `saas_nrr` | SaaS | % | 97.0 | 104.0 | 118.0 | Scalemetrics (2025) |
| `mfg_oee` | Mfg | % | 45.0 | 60.0 | 85.0 | Industry Reports |
| `saas_cac` | B2B Tech | USD | $1,000 | $656 | $239 | FirstPageSage |

---

## 4. Systemic Outcome Framework (SOF) Integration

The SOF layer provides the relational schema that maps "Interventions" (what we do) to "Outcomes" (what happens). This is implemented via a strict PostgreSQL schema.

![SOF Integration Diagram](https://r2.flowith.net/files/jpeg/8EJ9N-base_agent_architecture_uml_index_2@1024x1024.jpeg)

### 4.1 SOF Database Schema (Prisma)
The following schema enforces the logical structure where every value case is built upon a verified system map.

```typescript
// prisma/schema.prisma

model SofSystemMap {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  entities    SofEntity[]
  relations   SofRelationship[]
  feedback    SofFeedbackLoop[]
  createdAt   DateTime @default(now())
}

model SofEntity {
  id          String   @id @default(uuid())
  mapId       String
  type        EntityType // RESOURCE, PROCESS, METRIC, GOAL
  name        String
  baseline    Float?
  unit        String
  systemMap   SofSystemMap @relation(fields: [mapId], references: [id])
}

model SofRelationship {
  id          String   @id @default(uuid())
  mapId       String
  sourceId    String
  targetId    String
  type        RelationType // CAUSAL, FLOW, INFLUENCE
  strength    Float    // -1.0 to 1.0
  formula     String?  // Calculation logic
}

model ValueCase {
  id          String   @id @default(uuid())
  mapId       String
  vmrtData    Json     // Stores the full VMRT JSON object
  status      CaseStatus // DRAFT, VALIDATED, REALIZED
  
  // Link to Agent Audit
  createdById String   // Agent ID or User ID
}
```

---

## 5. Consistency & Governance

To maintain the "Single Source of Truth," the Value Fabric employs a rigorous governance layer managed by the **IntegrityAgent**.

### 5.1 Semantic Alignment Strategy
*   **Dictionary Enforcement:** The `metric_id` (e.g., `saas_nrr`) is the primary key. UI labels may vary ("Retention" vs "NRR"), but the underlying ID and calculation formula are immutable per tenant.
*   **Cross-Team Sync:** When Sales updates a baseline in the `ValueCase`, the `ExpansionAgent` receives an event to recalculate potential upsell opportunities for Customer Success.

### 5.2 Version Control (Time-Travel)
Every update to a `ValueCase` creates a snapshot. This allows ValueOS to answer:
> "What did we promise the customer in Q1, and how does that compare to the Q3 reality?"

*   **Audit Trails:** All writes include `agent_id`, `session_id`, and `reasoning_trace_id`.
*   **Rollback:** The `WorkflowOrchestrator` can revert the Value Fabric to a previous state if the `IntegrityAgent` detects a violation in a subsequent step.

---

## 6. Service Layer Implementation

The `ValueFabricService` is the primary interface for Agents to interact with the database. It abstracts the complexity of SOF storage and enforces schema validation.

### 6.1 ValueFabricService (TypeScript)

```typescript
import { z } from 'zod';
import { VMRT_Schema } from './schemas/vmrt';
import { ManifestoEnforcer } from './governance';

export class ValueFabricService {
  
  constructor(
    private readonly db: PrismaClient,
    private readonly enforcer: ManifestoEnforcer
  ) {}

  /**
   * Commits a reasoning trace to the permanent ledger.
   * Performs Zod validation and Manifesto policy checks.
   */
  async commitTrace(tenantId: string, trace: any): Promise<string> {
    // 1. Schema Validation
    const validatedTrace = VMRT_Schema.parse(trace);

    // 2. Policy Enforcement (Manifesto)
    const compliance = await this.enforcer.validate(validatedTrace);
    if (!compliance.passed) {
      throw new GovernanceError(compliance.violations);
    }

    // 3. Transactional Write
    return await this.db.$transaction(async (tx) => {
      // Create the immutable Value Case record
      const valueCase = await tx.valueCase.create({
        data: {
          tenantId,
          vmrtData: validatedTrace,
          status: 'VALIDATED',
          createdById: validatedTrace.metadata.creator.identifier
        }
      });

      // Update Semantic Vector Store for future retrieval
      await this.updateKnowledgeGraph(tx, validatedTrace);

      return valueCase.id;
    });
  }

  /**
   * Retrieves the 'Living Graph' for a specific customer.
   */
  async getSystemMap(customerId: string): Promise<SofSystemMap> {
    return this.db.sofSystemMap.findFirst({
      where: { customerId },
      include: { entities: true, relations: true }
    });
  }
}
```

---

## 7. Agent Integration Flows

The interaction between the Agent Fabric and Value Fabric is bidirectional. Agents read context to reason, and write insights to persist.

![Agent Fabric Integration Sequence](https://r2.flowith.net/files/jpeg/8CD03-agent_fabric_integration_sequence_index_5@1024x1024.jpeg)

### 7.1 The "Read-Reason-Write" Loop
1.  **Read (Context Loading):**
    *   `OpportunityAgent` queries `ValueFabricService.getSystemMap(id)` to load the current understanding of the customer's business.
2.  **Reason (Agent Fabric):**
    *   The agent identifies a bottleneck (e.g., high AP costs) and calculates ROI using the `TargetAgent`.
    *   *Reference:* See [Agent Fabric > Detailed Agent Profiles](./agent-fabric-architecture.md#3-detailed-agent-profiles).
3.  **Validate (Integrity Check):**
    *   The `IntegrityAgent` intercepts the result, checking the calculated ROI against the `GroundTruth` benchmarks in the Value Fabric.
4.  **Write (Commit):**
    *   Upon validation, the `ValueFabricService.commitTrace()` method is called, locking the value case into history.

### 7.2 Integration Table: Agent Roles

| Agent | Action | Value Fabric Artifact |
| :--- | :--- | :--- |
| **OpportunityAgent** | Writes | `sof_system_maps`, `sof_entities` (Nodes) |
| **TargetAgent** | Writes | `ValueCase`, `VMRT` (Financial Models) |
| **RealizationAgent** | Updates | `ProofPoint` (Realized vs. Committed) |
| **ExpansionAgent** | Reads | `ValueCase` (Gap Analysis) |
| **IntegrityAgent** | Validates | All Writes against `Manifesto` Rules |

---

## 8. Transition to Integration

With the **Value Fabric** established as the unified, governed storage layer for all economic reasoning, and the **Agent Fabric** operational as the cognitive engine, the final piece of the architecture is the interface. The **Integration & API Layer** exposes these capabilities to the outside world, enabling the Server-Driven UI (SDUI) to render these complex value graphs as intuitive, interactive canvases.

[Proceed to Integration & API Documentation >](./integration-api-layer.md)