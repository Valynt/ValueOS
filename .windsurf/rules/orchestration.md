---
trigger: glob
glob: src/lib/orchestration/**/*.ts, src/services/*Orchestrator*.ts
---

# Orchestration Layer

**Paths:** `src/lib/orchestration/*` & `src/services/*Orchestrator*.ts`

- Workflows = DAGs (cycles FORBIDDEN)
- Saga Pattern: compensation function required for every state mutation
- Persist `WorkflowState` to Supabase after EVERY node transition
