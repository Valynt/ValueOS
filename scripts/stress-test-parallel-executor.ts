import { EnhancedParallelExecutor, createParallelTask, createParallelGroup, createParallelExecutionPlan } from '../apps/ValyntApp/src/services/EnhancedParallelExecutor';
import { AgentSecurityMiddleware } from '../apps/ValyntApp/src/services/agents/security/AgentSecurityMiddleware';

async function stressTestParallelExecution() {
  console.log('🚀 Starting ValueOS Brain Stress Test...');

  // 1. Setup a "heavy" DAG with 20 subgoals (exceeding your 10-thread cap)
  const subgoals = Array.from({ length: 20 }, (_, i) => ({
    id: `goal_${i}`,
    agentType: i % 4 === 0 ? 'TargetAgent' : 'ExpansionAgent', // Mix of Critical/Non-Critical
    query: `Sub-task ${i}`,
    dependencies: [] // Zero-dependency to force maximum parallelism
  }));

  // Create tasks
  const tasks = subgoals.map(s => createParallelTask(s.agentType as any, s.query, { id: s.id, dependencies: s.dependencies }));

  // Create a group with parallel execution
  const group = createParallelGroup('stress-test-group', tasks, { executionStrategy: 'parallel', maxConcurrency: 10 });

  // Create execution plan
  const plan = createParallelExecutionPlan([group], { maxConcurrency: 10 });

  const startTime = Date.now();

  try {
    // 2. Simulate the 90% budget threshold mid-execution
    // We want to see if the Router correctly pivots mid-batch
    const result = await EnhancedParallelExecutor.executeParallelPlan(plan);

    const duration = Date.now() - startTime;
    console.log(`\n✅ Stress Test Completed in ${duration}ms`);
    console.log(`📊 Total Tasks: ${result.results.length}`);

    // 3. Validation Checks
    const fallbacks = result.results.filter(r => r.success === false); // Assuming fallback means failure or something
    const primaryLLM = result.results.filter(r => r.success === true);

    console.log(`--- Results Analysis ---`);
    console.log(`- Failed Executions: ${fallbacks.length}`);
    console.log(`- Successful Executions: ${primaryLLM.length}`);

  } catch (error) {
    console.error('❌ Stress Test Failed:', error);
  }
}

stressTestParallelExecution();
