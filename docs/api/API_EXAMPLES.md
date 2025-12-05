# API Examples & Use Cases

**Date:** November 22, 2024  
**Purpose:** Real-world examples of using ValueCanvas APIs  
**Audience:** Developers integrating with ValueCanvas

---

## Table of Contents

- [Agent System Examples](#agent-system-examples)
- [SDUI Generation Examples](#sdui-generation-examples)
- [Database Operations](#database-operations)
- [Workflow Orchestration](#workflow-orchestration)
- [SOF Framework](#sof-framework)
- [Authentication & Authorization](#authentication--authorization)
- [Real-World Use Cases](#real-world-use-cases)

---

## Agent System Examples

### Example 1: Simple Agent Task

```typescript
import { CoordinatorAgent } from './agents/CoordinatorAgent';

// Create coordinator
const coordinator = new CoordinatorAgent();

// Plan a task
const plan = await coordinator.planTask({
  intent_type: 'value_discovery',
  intent_description: 'Identify cost reduction opportunities in supply chain',
  business_case_id: 'case-123',
  user_id: 'user-456',
});

console.log('Task Plan:', plan);
// Output: { task_id, subgoals: [...], routing: [...] }
```

### Example 2: Agent Communication

```typescript
import { CommunicatorAgent } from './agents/CommunicatorAgent';

// Create communicator
const comm = new CommunicatorAgent('MyAgent');

// Send message to another agent
await comm.sendMessage(
  'SystemMapperAgent',
  'task_assignment',
  {
    task_id: 'task-789',
    system_id: 'system-123',
    analysis_type: 'feedback_loops',
  },
  { priority: 'high' }
);

// Listen for responses
comm.subscribe('agent.myagent', async (event) => {
  console.log('Received:', event);
});
```

### Example 3: Request-Response Pattern

```typescript
import { CommunicatorAgent } from './agents/CommunicatorAgent';

const comm = new CommunicatorAgent('ClientAgent');

// Send request and wait for response
const response = await comm.request<{ analysis: any }>(
  'SystemMapperAgent',
  {
    action: 'analyze_system',
    system_id: 'system-123',
  },
  5000 // timeout
);

console.log('Analysis:', response.analysis);
```

### Example 4: Broadcasting Events

```typescript
import { CommunicatorAgent } from './agents/CommunicatorAgent';

const comm = new CommunicatorAgent('EventPublisher');

// Broadcast to all agents
await comm.broadcast(
  'status_update',
  {
    event: 'system_updated',
    system_id: 'system-123',
    timestamp: new Date().toISOString(),
  },
  { priority: 'normal' }
);
```

---

## SDUI Generation Examples

### Example 1: Generate Dashboard

```typescript
import { CoordinatorAgent } from './agents/CoordinatorAgent';

const coordinator = new CoordinatorAgent();

// Generate dashboard layout
const layout = await coordinator.produceSDUILayout({
  id: 'subgoal-1',
  subgoal_type: 'dashboard_creation',
  subgoal_description: 'Create executive dashboard showing KPIs',
  output: {
    kpis: [
      { name: 'Revenue', value: 1000000, trend: 'up' },
      { name: 'Costs', value: 750000, trend: 'down' },
    ],
  },
  estimated_complexity: 5,
  dependencies: [],
  status: 'in_progress',
  created_at: new Date().toISOString(),
});

console.log('Generated Layout:', layout);
```

### Example 2: Render SDUI Page

```typescript
import { renderPage } from './sdui/renderPage';

// Define page structure
const pageDefinition = {
  type: 'page',
  title: 'Value Discovery',
  sections: [
    {
      id: 'section-1',
      type: 'grid',
      columns: 2,
      components: [
        {
          id: 'comp-1',
          type: 'MetricCard',
          props: {
            title: 'Total Value',
            value: '$1.2M',
            trend: 'up',
            change: '+15%',
          },
        },
        {
          id: 'comp-2',
          type: 'InteractiveChart',
          props: {
            title: 'Value Over Time',
            data: [/* chart data */],
            chartType: 'line',
          },
        },
      ],
    },
  ],
};

// Render the page
const Page = renderPage(pageDefinition);

// Use in React
function App() {
  return <Page />;
}
```

### Example 3: Dynamic Component Selection

```typescript
import { searchComponentTools } from './sdui/ComponentToolRegistry';

// Search for appropriate components
const components = searchComponentTools(
  'Show financial metrics with trends',
  5
);

console.log('Suggested Components:', components);
// Output: [
//   { name: 'MetricCard', score: 0.95, ... },
//   { name: 'TrendChart', score: 0.87, ... },
// ]
```

---

## Database Operations

### Example 1: Query with Supabase

```typescript
import { supabase } from './lib/supabase';

// Fetch agent sessions
const { data, error } = await supabase
  .from('agent_sessions')
  .select('*')
  .eq('user_id', 'user-123')
  .eq('status', 'active')
  .order('started_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Sessions:', data);
}
```

### Example 2: Insert with RLS

```typescript
import { supabase } from './lib/supabase';

// Insert new workflow execution
const { data, error } = await supabase
  .from('workflow_executions')
  .insert({
    workflow_id: 'workflow-123',
    status: 'running',
    started_at: new Date().toISOString(),
    context: {
      user_id: 'user-123',
      case_id: 'case-456',
    },
  })
  .select()
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Created:', data);
}
```

### Example 3: Real-time Subscriptions

```typescript
import { supabase } from './lib/supabase';

// Subscribe to agent metrics
const subscription = supabase
  .channel('agent-metrics')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'agent_metrics',
      filter: `agent_name=eq.CoordinatorAgent`,
    },
    (payload) => {
      console.log('New metric:', payload.new);
    }
  )
  .subscribe();

// Cleanup
// subscription.unsubscribe();
```

---

## Workflow Orchestration

### Example 1: Execute Workflow

```typescript
import { workflowOrchestrator } from './services/WorkflowOrchestrator';

// Execute a workflow
const execution = await workflowOrchestrator.executeWorkflow(
  'value-discovery-workflow',
  {
    case_id: 'case-123',
    user_id: 'user-456',
    parameters: {
      industry: 'manufacturing',
      focus_area: 'supply_chain',
    },
  }
);

console.log('Execution ID:', execution.id);
console.log('Status:', execution.status);
```

### Example 2: Monitor Workflow

```typescript
import { workflowOrchestrator } from './services/WorkflowOrchestrator';

// Get execution status
const status = await workflowOrchestrator.getExecutionStatus(
  'execution-123'
);

console.log('Status:', status.status);
console.log('Progress:', status.progress);
console.log('Current Task:', status.current_task);
```

### Example 3: Simulate Workflow

```typescript
import { workflowOrchestrator } from './services/WorkflowOrchestrator';

// Simulate workflow execution
const simulation = await workflowOrchestrator.simulateWorkflow(
  'value-discovery-workflow',
  {
    case_id: 'case-123',
    parameters: {
      industry: 'manufacturing',
    },
  }
);

console.log('Estimated Duration:', simulation.estimated_duration);
console.log('Predicted Outcome:', simulation.predicted_outcome);
console.log('Confidence:', simulation.confidence);
```

---

## SOF Framework

### Example 1: Create System Map

```typescript
import { SystemMapperAgent } from './agents/SystemMapperAgent';

const mapper = new SystemMapperAgent();

// Map a system
const systemMap = await mapper.mapSystem({
  name: 'Supply Chain System',
  description: 'End-to-end supply chain operations',
  scope: 'enterprise',
  context: {
    industry: 'manufacturing',
    size: 'large',
  },
});

console.log('System Map:', systemMap);
```

### Example 2: Identify Interventions

```typescript
import { InterventionDesignerAgent } from './agents/InterventionDesignerAgent';

const designer = new InterventionDesignerAgent();

// Design interventions
const interventions = await designer.designInterventions({
  system_map_id: 'map-123',
  objectives: [
    'Reduce lead time by 30%',
    'Improve quality by 20%',
  ],
  constraints: {
    budget: 500000,
    timeline: '6 months',
  },
});

console.log('Interventions:', interventions);
```

### Example 3: Track Realization

```typescript
import { RealizationLoopAgent } from './agents/RealizationLoopAgent';

const realization = new RealizationLoopAgent();

// Track value realization
const progress = await realization.trackRealization({
  intervention_id: 'intervention-123',
  metrics: [
    { name: 'lead_time', current: 25, target: 21, unit: 'days' },
    { name: 'quality_score', current: 85, target: 90, unit: 'percent' },
  ],
});

console.log('Progress:', progress);
```

---

## Authentication & Authorization

### Example 1: Sign Up

```typescript
import { supabase } from './lib/supabase';

// Sign up new user
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe',
      role: 'analyst',
    },
  },
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('User:', data.user);
}
```

### Example 2: Sign In

```typescript
import { supabase } from './lib/supabase';

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('Session:', data.session);
}
```

### Example 3: Check Permissions

```typescript
import { supabase } from './lib/supabase';

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Check role
const isAdmin = user?.user_metadata?.role === 'admin';

// Query with RLS
const { data, error } = await supabase
  .from('sensitive_data')
  .select('*');
// RLS policies automatically filter based on user
```

---

## Real-World Use Cases

### Use Case 1: Cost Reduction Analysis

```typescript
// Complete workflow for cost reduction
async function analyzeCostReduction(companyId: string) {
  const coordinator = new CoordinatorAgent();
  
  // 1. Plan the analysis
  const plan = await coordinator.planTask({
    intent_type: 'cost_analysis',
    intent_description: 'Identify cost reduction opportunities',
    business_case_id: companyId,
    user_id: 'current-user',
  });
  
  // 2. Execute subgoals
  for (const subgoal of plan.subgoals) {
    const layout = await coordinator.produceSDUILayout(subgoal);
    // Render UI for user interaction
  }
  
  // 3. Generate report
  const report = await generateReport(plan);
  
  return report;
}
```

### Use Case 2: Process Optimization

```typescript
// Optimize business process
async function optimizeProcess(processId: string) {
  const mapper = new SystemMapperAgent();
  const designer = new InterventionDesignerAgent();
  
  // 1. Map current process
  const systemMap = await mapper.mapSystem({
    name: `Process ${processId}`,
    description: 'Current state analysis',
    scope: 'process',
  });
  
  // 2. Identify bottlenecks
  const bottlenecks = await mapper.identifyBottlenecks(systemMap.id);
  
  // 3. Design interventions
  const interventions = await designer.designInterventions({
    system_map_id: systemMap.id,
    objectives: ['Reduce cycle time', 'Improve throughput'],
  });
  
  // 4. Simulate outcomes
  const simulations = await Promise.all(
    interventions.map(i => simulateIntervention(i))
  );
  
  return { systemMap, bottlenecks, interventions, simulations };
}
```

### Use Case 3: Value Discovery Dashboard

```typescript
// Create interactive value discovery dashboard
async function createValueDashboard(caseId: string) {
  const coordinator = new CoordinatorAgent();
  
  // Generate dashboard layout
  const layout = await coordinator.produceSDUILayout({
    id: 'dashboard-subgoal',
    subgoal_type: 'dashboard_creation',
    subgoal_description: 'Value discovery dashboard with KPIs and trends',
    output: await fetchValueMetrics(caseId),
    estimated_complexity: 6,
    dependencies: [],
    status: 'in_progress',
    created_at: new Date().toISOString(),
  });
  
  // Render dashboard
  return renderPage(layout);
}

async function fetchValueMetrics(caseId: string) {
  const { data } = await supabase
    .from('value_metrics')
    .select('*')
    .eq('case_id', caseId);
    
  return {
    total_value: calculateTotal(data),
    trends: calculateTrends(data),
    opportunities: identifyOpportunities(data),
  };
}
```

### Use Case 4: Collaborative Planning

```typescript
// Multi-user collaborative planning session
async function startCollaborativeSession(sessionId: string) {
  const comm = new CommunicatorAgent('SessionHost');
  
  // Broadcast session start
  await comm.broadcast('status_update', {
    event: 'session_started',
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  });
  
  // Listen for participant actions
  comm.subscribe(`session.${sessionId}`, async (event) => {
    if (event.message_type === 'data_request') {
      // Handle participant requests
      const response = await processRequest(event.payload);
      await comm.reply(event, response);
    }
  });
  
  // Enable real-time updates
  const subscription = supabase
    .channel(`session-${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'session_data',
      filter: `session_id=eq.${sessionId}`,
    }, (payload) => {
      // Broadcast changes to all participants
      comm.broadcast('data_response', payload.new);
    })
    .subscribe();
    
  return { comm, subscription };
}
```

### Use Case 5: Automated Reporting

```typescript
// Generate automated value realization report
async function generateValueReport(caseId: string, period: string) {
  const realization = new RealizationLoopAgent();
  const evaluator = new ValueEvalAgent();
  
  // 1. Fetch realization data
  const { data: metrics } = await supabase
    .from('realization_metrics')
    .select('*')
    .eq('case_id', caseId)
    .gte('timestamp', period);
  
  // 2. Track progress
  const progress = await realization.trackRealization({
    intervention_id: caseId,
    metrics: metrics.map(m => ({
      name: m.metric_name,
      current: m.current_value,
      target: m.target_value,
      unit: m.unit,
    })),
  });
  
  // 3. Evaluate quality
  const evaluation = await evaluator.evaluateArtifact(
    'realization_report',
    caseId,
    { progress, metrics }
  );
  
  // 4. Generate report layout
  const coordinator = new CoordinatorAgent();
  const layout = await coordinator.produceSDUILayout({
    id: 'report-subgoal',
    subgoal_type: 'report_generation',
    subgoal_description: 'Value realization report',
    output: { progress, evaluation, metrics },
    estimated_complexity: 7,
    dependencies: [],
    status: 'in_progress',
    created_at: new Date().toISOString(),
  });
  
  return { layout, progress, evaluation };
}
```

---

## Error Handling

### Example: Robust Error Handling

```typescript
import { log } from './lib/logger';

async function robustAgentCall() {
  try {
    const coordinator = new CoordinatorAgent();
    const plan = await coordinator.planTask({
      intent_type: 'value_discovery',
      intent_description: 'Analyze opportunities',
      business_case_id: 'case-123',
      user_id: 'user-456',
    });
    
    return { success: true, data: plan };
  } catch (error) {
    // Log error with context
    log.error('Agent call failed', error as Error, {
      component: 'AgentSystem',
      action: 'plan_task',
      caseId: 'case-123',
    });
    
    // Return graceful error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

## Testing Examples

### Example: Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { CoordinatorAgent } from './agents/CoordinatorAgent';

describe('CoordinatorAgent', () => {
  it('should plan a task', async () => {
    const coordinator = new CoordinatorAgent();
    
    const plan = await coordinator.planTask({
      intent_type: 'value_discovery',
      intent_description: 'Test task',
      business_case_id: 'test-case',
      user_id: 'test-user',
    });
    
    expect(plan).toBeDefined();
    expect(plan.subgoals).toBeInstanceOf(Array);
    expect(plan.subgoals.length).toBeGreaterThan(0);
  });
});
```

---

## Best Practices

### 1. Always Handle Errors

```typescript
// Good
try {
  const result = await agent.process();
  return result;
} catch (error) {
  log.error('Processing failed', error);
  return fallbackValue;
}

// Bad
const result = await agent.process(); // No error handling
```

### 2. Use Structured Logging

```typescript
// Good
log.info('Task completed', {
  component: 'CoordinatorAgent',
  action: 'plan_task',
  taskId: task.id,
  duration: Date.now() - startTime,
});

// Bad
console.log('Task completed:', task.id);
```

### 3. Type Your Data

```typescript
// Good
interface TaskResult {
  id: string;
  status: 'completed' | 'failed';
  data: unknown;
}

const result: TaskResult = await processTask();

// Bad
const result: any = await processTask();
```

### 4. Clean Up Resources

```typescript
// Good
const subscription = supabase.channel('updates').subscribe();
// ... use subscription ...
await subscription.unsubscribe();

// Bad
supabase.channel('updates').subscribe();
// Never cleaned up
```

---

## Additional Resources

- **API Reference:** [SERVICES_API.md](./SERVICES_API.md)
- **Architecture:** [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)
- **Testing:** [TESTING_FRAMEWORK_COMPLETE.md](./TESTING_FRAMEWORK_COMPLETE.md)
- **Security:** [SECURITY.md](./SECURITY.md)

---

**Last Updated:** November 22, 2024  
**Contributions Welcome:** Submit PR with new examples!
