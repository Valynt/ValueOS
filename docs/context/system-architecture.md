# System Architecture & Agents Context

## 1. The 7-Agent Fabric

ValueOS uses a Multi-Agent Reinforcement Learning (MARL) loop. Agents are located in `src/lib/agent-fabric/`.

### Agent Taxonomy

| Agent                 | Authority | Purpose                                         | Lifecycle Stage |
| :-------------------- | :-------- | :---------------------------------------------- | :-------------- |
| **Coordinator**       | 5         | Orchestrates handoffs and task planning.        | All             |
| **Opportunity**       | 3         | Discovers pain points and objectives.           | Discovery       |
| **Target**            | 3         | Builds value models and maps capabilities.      | Modeling        |
| **FinancialModeling** | 4         | Calculates ROI, NPV, IRR using `decimal.js`.    | Modeling        |
| **Realization**       | 3         | Tracks actual vs. predicted metrics post-sale.  | Realization     |
| **Expansion**         | 3         | Identifies upsell/cross-sell opportunities.     | Expansion       |
| **Integrity**         | 5         | Vetoes non-compliant or hallucinated proposals. | All             |
| **Communicator**      | 2         | Generates persona-specific narratives.          | All             |

## 2. Authority Levels

- **Level 1 (Read-Only):** View data, generate reports.
- **Level 2 (Analysis):** Pattern recognition, insights.
- **Level 3 (Operations):** Read/write business data, execute workflows.
- **Level 4 (Integration):** External API access, financial operations.
- **Level 5 (System):** Full access, policy enforcement, Integrity veto.

## 3. Orchestration Patterns

### The `secureInvoke` Wrapper

Agents never write directly to the database. They submit a "Commit Proposal" to the `secureInvoke` service, which triggers an **IntegrityAgent** review. Only `VALIDATED` signals permit SQL transactions.

### Circuit Breaker States

- **Closed:** Normal operation.
- **Open:** Failure detected; requests fail fast to prevent cascading.
- **Half-Open:** Testing recovery with limited requests.

## 4. Memory System

- **Episodic:** Specific events/interactions.
- **Semantic:** General knowledge (pgvector embeddings).
- **Working:** Current task context.
- **Shared:** Cross-agent knowledge sharing.

---

**Last Updated:** 2026-01-28
**Related:** `src/lib/agent-fabric/`, `src/services/UnifiedAgentAPI.ts`
