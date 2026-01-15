---
trigger: glob
glob: src/lib/orchestration/**/*.ts, src/services/*Orchestrator*.ts, src/services/workflows/**/*.ts
---

# Orchestration Layer

**Paths:** `src/lib/orchestration/*`, `src/services/*Orchestrator*.ts`, `src/services/workflows/*`

- Workflows = DAGs (cycles FORBIDDEN)
- Saga Pattern: compensation function required for every state mutation
- Persist `WorkflowState` to Supabase after EVERY node transition
