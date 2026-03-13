# Workflow Feature

Provides workflow definition, step management, and execution for the ValueOS lifecycle.

## State machines

### Workflow (`WorkflowStatus`)

```
draft → active → completed
              ↘ failed
active → paused → active
```

### Step (`StepStatus`)

```
pending → running → completed
                 ↘ failed
pending → skipped
```

## Data contracts

### `Workflow`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `name` | `string` | |
| `status` | `WorkflowStatus` | `draft \| active \| paused \| completed \| failed` |
| `steps` | `WorkflowStep[]` | Ordered by `step.order` |
| `currentStepId` | `string?` | ID of the step currently executing |
| `createdAt` / `updatedAt` | ISO 8601 | |

### `WorkflowStep`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `type` | `"action" \| "condition" \| "delay" \| "human" \| "agent"` | `human` = requires human checkpoint; `agent` = dispatched to agent-fabric |
| `status` | `StepStatus` | `pending \| running \| completed \| failed \| skipped` |
| `config` | `Record<string, unknown>` | Step-type-specific configuration |
| `order` | `number` | Zero-based execution order |

### `WorkflowExecution`

Returned by `POST /api/workflows/execute`. Contains `logs: WorkflowLog[]` with per-step `info | warn | error` entries and timestamps.

## `useWorkflow` hook

```typescript
const {
  workflow,        // Workflow | null — current workflow state
  isLoading,       // boolean
  error,           // string | null
  loadWorkflow,    // (id: string) => Promise<void>
  addStep,         // (step: Omit<WorkflowStep, "id" | "order">) => void
  updateStep,      // (stepId: string, updates: Partial<WorkflowStep>) => void
  removeStep,      // (stepId: string) => void
  reorderSteps,    // (fromIndex: number, toIndex: number) => void
  executeWorkflow, // () => Promise<void> — sets status to "active" on success, "failed" on error
} = useWorkflow(workflowId?);
```

Step mutations (`addStep`, `updateStep`, `removeStep`, `reorderSteps`) are local-only — they update React state but do not persist to the backend. Call a save/update API endpoint separately if persistence is needed.

`executeWorkflow` calls `POST /api/workflows/execute` and transitions `workflow.status` to `"active"` on success or `"failed"` on error.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/workflows/:id` | Load a workflow by ID |
| `POST` | `/api/workflows/execute` | Start execution (`{ workflowId }`) |
| `GET` | `/api/workflows/:id/status` | Poll execution status |

## `IntegrityService`

Singleton (`IntegrityService.getInstance()`) used by `ScenarioModeler` to validate assumptions before they enter the financial model.

- `validateAssumption(metricId, value, { industry, benchmarkMedian })` — rejects values exceeding 120% of the benchmark median; returns `{ isValid, suggestedValue, confidenceScore }`.
- `logToVMRT(log)` — appends a reasoning trace entry (Value Modeling Reasoning Trace) for audit. Hash field is currently a mock placeholder.
- `getVMRTLogs()` — returns all in-memory VMRT entries (not persisted across page loads).

## Components

| Component | Purpose |
|---|---|
| `RealizationDashboard` | Bar chart visualisation of realization metrics |
| `ScenarioModeler` | Scenario comparison UI; calls `IntegrityService.validateAssumption` before applying values |
| `DecimalCalculator` | Arbitrary-precision arithmetic input using `decimal.js` |

## Human checkpoint flow

Steps with `type: "human"` pause execution and surface a checkpoint via `SDUIHumanCheckpointProvider` (wired in `AppRoutes.tsx`). The checkpoint must be approved or rejected before the workflow advances. See `apps/ValyntApp/src/app/providers/SDUIHumanCheckpointProvider.tsx` and `components/Workflow/HumanCheckpoint.tsx`.
