# Workflow DAG System

Complete workflow orchestration system with canonical DAG definitions, compensation logic, and idempotent retry mechanisms.

## Overview

The Workflow DAG system provides end-to-end orchestration for the Value Lifecycle:

```
Opportunity → Target → Realization → Expansion → Integrity
```

## Architecture

### Components

1. **WorkflowDAGDefinitions.ts** - Canonical workflow definitions
2. **WorkflowDAGIntegration.ts** - Integration with AgentOrchestrator
3. **WorkflowCompensation.ts** - Compensation logic for rollbacks
4. **CircuitBreaker.ts** - Circuit breaker protection
5. **AgentAPI.ts** - Agent invocation layer

### Data Flow

```
User Request
    ↓
AgentOrchestrator.executeWorkflowDAG()
    ↓
WorkflowDAGExecutor.executeWorkflow()
    ↓
Create Execution Record (Supabase)
    ↓
Execute DAG Stages (Sequential/Parallel)
    ↓
For Each Stage:
    ├─ Check Circuit Breaker
    ├─ Execute with Retry Logic
    ├─ Record Executed Step (Idempotency)
    ├─ Log Events
    └─ Transition to Next Stage
    ↓
On Success: Complete Workflow
On Failure: Trigger Compensation
```

## Workflow Definitions

### 1. Opportunity Discovery Workflow

**ID**: `opportunity-discovery-v1`

**Stages**:
1. Market Research & Analysis (90s timeout)
2. Opportunity Validation (60s timeout)
3. Opportunity Prioritization (45s timeout)

**Features**:
- Market analysis and competitive intelligence
- Stakeholder analysis and feasibility checks
- Scoring and ranking capabilities

### 2. Target Value Commit Workflow

**ID**: `target-value-commit-v1`

**Stages**:
1. KPI Target Definition (120s timeout)
2. Target Validation & Approval (90s timeout)
3. Value Commitment (60s timeout)
4. Measurement Framework Setup (75s timeout)

**Features**:
- KPI modeling and baseline analysis
- Stakeholder approval workflows
- Contract generation and SLA definition
- Metric instrumentation

### 3. Realization Tracking Workflow

**ID**: `realization-tracking-v1`

**Stages**:
1. Data Collection & Aggregation (120s timeout)
2. Performance Analysis (90s timeout)
3. Stakeholder Reporting (60s timeout)
4. Intervention Planning (75s timeout, conditional)

**Features**:
- Data ingestion and metric calculation
- Variance analysis and trend detection
- Report generation and dashboard updates
- Risk assessment and action planning

### 4. Expansion Modeling Workflow

**ID**: `expansion-modeling-v1`

**Stages**:
1. Expansion Opportunity Scanning (90s timeout)
2. Scenario Modeling & Analysis (120s timeout)
3. Business Case Development (90s timeout)
4. Expansion Roadmap Planning (75s timeout)

**Features**:
- Market scanning and capability assessment
- Financial modeling and risk analysis
- ROI calculation
- Timeline planning and resource allocation

### 5. Integrity & Compliance Workflow

**ID**: `integrity-controls-v1`

**Stages**:
1. Data Integrity Validation (90s timeout)
2. Compliance Verification (120s timeout)
3. Audit Trail Generation (60s timeout)
4. Integrity Certification (45s timeout)

**Features**:
- Data quality and consistency validation
- Policy validation and regulatory checks
- Log generation and provenance tracking
- Signature generation and attestation

### 6. Complete Lifecycle Workflow

**ID**: `complete-value-lifecycle-v1`

**Description**: End-to-end workflow across all lifecycle stages

**Stages**:
1. Opportunity Discovery (90s)
2. Value Commit & KPI Targets (120s)
3. Realization Tracking (120s)
4. Expansion Modeling (90s)
5. Integrity & Compliance Controls (90s)

### 7. Parallel Lifecycle Workflow

**ID**: `parallel-value-lifecycle-v1`

**Description**: Optimized workflow with parallel execution

**Stages**:
1. Opportunity Discovery (90s)
2. Target Definition (Parallel, 120s)
3. Integrity Setup (Parallel, 60s)
4. Realization Tracking (120s)
5. Expansion Modeling (90s)

**Features**:
- Fork/Join pattern for parallel execution
- Reduced total execution time
- Independent stage execution

## Retry Configurations

### Standard Retry
- Max attempts: 3
- Initial delay: 500ms
- Max delay: 5000ms
- Multiplier: 2x
- Jitter: Enabled

### Aggressive Retry
- Max attempts: 5
- Initial delay: 1000ms
- Max delay: 10000ms
- Multiplier: 2x
- Jitter: Enabled

### Conservative Retry
- Max attempts: 2
- Initial delay: 1000ms
- Max delay: 3000ms
- Multiplier: 1.5x
- Jitter: Disabled

### No Retry
- Max attempts: 1
- For idempotent operations

## Compensation Logic

### Compensation Handlers

Each stage can define a compensation handler for rollback:

```typescript
createStage(
  'opportunity_research',
  'Market Research & Analysis',
  'opportunity',
  90,
  RETRY_CONFIGS.STANDARD,
  'compensateOpportunityResearch', // Compensation handler
  ['market_analysis', 'competitive_intelligence']
)
```

### Compensation Process

1. **Trigger**: Workflow failure or explicit rollback request
2. **Execution**: Reverse order of executed steps
3. **Idempotency**: Skip already compensated steps
4. **Policy**: Continue on error or halt on error
5. **Logging**: Complete audit trail of compensation

### Compensation Handlers by Stage

- **Opportunity**: Delete opportunity artifacts
- **Target**: Revert to draft, cancel value commits, delete KPI targets
- **Realization**: Delete realization artifacts
- **Expansion**: Delete expansion artifacts
- **Integrity**: Delete integrity artifacts

## Idempotent Execution

### Idempotency Guarantees

1. **Stage Execution**: Check if stage already executed before running
2. **Retry Logic**: Safe to retry any stage multiple times
3. **Compensation**: Safe to run compensation multiple times
4. **State Tracking**: Executed steps recorded in execution context

### Implementation

```typescript
// Check if stage already completed (idempotency)
const executedSteps: ExecutedStep[] = context.executed_steps || [];
const alreadyExecuted = executedSteps.find((step) => step.stage_id === stage.id);
if (alreadyExecuted) {
  console.log(`Stage ${stage.id} already executed, skipping (idempotent)`);
  return { idempotent: true, previous_execution: alreadyExecuted };
}
```

## Circuit Breaker Integration

### Per-Stage Circuit Breakers

Each workflow stage has its own circuit breaker:

```
Key: ${workflowId}:${stageId}
```

### Circuit Breaker States

- **Closed**: Normal operation
- **Open**: Failures exceeded threshold, blocking requests
- **Half-Open**: Testing if service recovered

### Configuration

- Failure threshold: 5 failures
- Cooldown period: 60 seconds
- Automatic recovery testing

## Usage Examples

### Execute Complete Lifecycle Workflow

```typescript
import { executeWorkflowDAG } from './services/AgentOrchestrator';

const executionId = await executeWorkflowDAG(
  'complete-value-lifecycle-v1',
  {
    userId: 'user-123',
    organizationId: 'org-456',
    projectId: 'project-789',
  },
  'user-123'
);

console.log('Workflow execution started:', executionId);
```

### Monitor Workflow Status

```typescript
import { getWorkflowStatus } from './services/AgentOrchestrator';

const status = await getWorkflowStatus(executionId);
console.log('Current stage:', status.current_stage);
console.log('Status:', status.status);
console.log('Executed steps:', status.context.executed_steps);
```

### Retry Failed Workflow

```typescript
import { retryFailedWorkflow } from './services/AgentOrchestrator';

const newExecutionId = await retryFailedWorkflow(executionId, 'user-123');
console.log('Retry execution started:', newExecutionId);
```

### Get Available Workflows

```typescript
import { getAvailableWorkflows } from './services/AgentOrchestrator';

const workflows = getAvailableWorkflows();
workflows.forEach(workflow => {
  console.log(`${workflow.name} (${workflow.id})`);
  console.log(`  Stages: ${workflow.stages.length}`);
  console.log(`  Version: ${workflow.version}`);
});
```

### Check Circuit Breaker Status

```typescript
import { getWorkflowCircuitBreakerStatus } from './services/AgentOrchestrator';

const status = getWorkflowCircuitBreakerStatus(
  'complete-value-lifecycle-v1',
  'opportunity_discovery'
);

console.log('Circuit breaker state:', status.state);
console.log('Failure count:', status.failure_count);
```

### Reset Circuit Breaker

```typescript
import { resetWorkflowCircuitBreaker } from './services/AgentOrchestrator';

resetWorkflowCircuitBreaker(
  'complete-value-lifecycle-v1',
  'opportunity_discovery'
);
```

## Database Schema

### workflow_definitions

Stores workflow DAG definitions:

```sql
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL,
  dag_schema JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, version)
);
```

### workflow_executions

Tracks workflow execution instances:

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id TEXT NOT NULL,
  workflow_version INTEGER,
  status TEXT NOT NULL,
  current_stage TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  context JSONB,
  audit_context JSONB,
  circuit_breaker_state JSONB,
  created_by UUID NOT NULL
);
```

### workflow_events

Logs all workflow events:

```sql
CREATE TABLE workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  stage_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Initialization

### Register Workflows on Startup

```typescript
import { initializeWorkflowSystem } from './services/AgentOrchestrator';

// In your app initialization
await initializeWorkflowSystem();
```

This registers all workflow definitions in the database.

## Error Handling

### Retryable Errors

The system automatically retries these error types:
- Timeout errors
- Network errors
- Connection errors
- Temporary errors
- Rate limit errors
- HTTP 502, 503, 504 errors

### Non-Retryable Errors

These errors fail immediately:
- Validation errors
- Authentication errors
- Authorization errors
- HTTP 400, 401, 403, 404 errors

### Exponential Backoff

Retry delays increase exponentially:

```
Attempt 1: 500ms
Attempt 2: 1000ms (500ms * 2^1)
Attempt 3: 2000ms (500ms * 2^2)
```

With jitter (±25%) to prevent thundering herd.

## Validation

### Workflow Validation

All workflows are validated before registration:

```typescript
import { validateWorkflowDAG } from './services/workflows/WorkflowDAGDefinitions';

const validation = validateWorkflowDAG(workflow);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Validation warnings:', validation.warnings);
}
```

### Validation Checks

- Initial stage exists in stages
- Final stages exist in stages
- All transitions reference valid stages
- No unreachable stages (warning)
- Cycle detection (warning)

## Performance Considerations

### Parallel Execution

Use `parallel-value-lifecycle-v1` for:
- Independent stages
- Reduced total execution time
- Higher resource utilization

### Sequential Execution

Use `complete-value-lifecycle-v1` for:
- Dependent stages
- Simpler debugging
- Lower resource utilization

### Timeout Configuration

Adjust timeouts based on:
- Agent complexity
- Data volume
- Network latency
- Resource availability

## Monitoring

### Key Metrics

- Workflow execution time
- Stage execution time
- Retry count per stage
- Circuit breaker state
- Compensation frequency
- Success/failure rate

### Logging

All events are logged to `workflow_events`:
- workflow_initiated
- stage_started
- stage_attempt
- stage_completed
- stage_failed
- workflow_completed
- workflow_failed
- workflow_rolled_back
- compensation_failed

## Best Practices

1. **Always validate workflows** before registration
2. **Use appropriate retry configs** for each stage
3. **Implement compensation handlers** for all stages
4. **Monitor circuit breaker status** regularly
5. **Set realistic timeouts** based on agent complexity
6. **Use parallel execution** when stages are independent
7. **Test compensation logic** thoroughly
8. **Log all important events** for debugging
9. **Handle retryable vs non-retryable errors** appropriately
10. **Use idempotent operations** in all stages

## Troubleshooting

### Workflow Stuck in "in_progress"

Check:
- Stage timeout configuration
- Circuit breaker status
- Agent availability
- Database connectivity

### High Retry Count

Check:
- Agent performance
- Network stability
- Timeout configuration
- Circuit breaker threshold

### Compensation Failures

Check:
- Compensation handler implementation
- Database connectivity
- Artifact existence
- Compensation timeout

### Circuit Breaker Always Open

Check:
- Agent health
- Failure threshold configuration
- Cooldown period
- Error patterns

## Future Enhancements

- [ ] Conditional transitions based on stage output
- [ ] Dynamic timeout adjustment
- [ ] Workflow templates
- [ ] Workflow versioning and migration
- [ ] Advanced parallel execution patterns
- [ ] Workflow scheduling
- [ ] Workflow dependencies
- [ ] Real-time workflow monitoring UI
- [ ] Workflow analytics and insights
- [ ] Custom compensation strategies

## References

- [Workflow Types](../../types/workflow.ts)
- [Agent API](../AgentAPI.ts)
- [Circuit Breaker](../CircuitBreaker.ts)
- [Workflow Compensation](../WorkflowCompensation.ts)
- [Agent Orchestrator](../AgentOrchestrator.ts)
