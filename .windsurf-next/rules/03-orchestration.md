# Orchestration Layer

**Paths:** `src/services/WorkflowOrchestrator.ts` & `src/lib/orchestration/*`

- Workflows = DAGs using `WorkflowDAGDefinitions.ts` (cycles FORBIDDEN)
- Saga Pattern: compensation function required for every state mutation
- Persist `WorkflowState` to Supabase after EVERY node transition
