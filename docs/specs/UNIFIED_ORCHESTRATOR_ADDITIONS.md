# UnifiedAgentOrchestrator - Simulation & Guardrails Addition

## Summary

Add simulation and guardrails features from WorkflowOrchestrator to UnifiedAgentOrchestrator.

---

## 1. Add Class Properties

Add to the UnifiedAgentOrchestrator class (after existing properties):

```typescript
export class UnifiedAgentOrchestrator {
  private config: OrchestratorConfig;
  private agentAPI: AgentAPI;
  private agentRegistry: AgentRegistry;
  private routingLayer: AgentRoutingLayer;
  private circuitBreakers: CircuitBreakerManager;
  
  // ADD THESE:
  private memorySystem: MemorySystem;
  private llmGateway: LLMGateway;
  private executionStartTimes: Map<string, number> = new Map();
```

---

## 2. Update Constructor

Add initialization in constructor:

```typescript
constructor(config?: Partial<OrchestratorConfig>) {
  this.config = { ...DEFAULT_CONFIG, ...config };
  this.agentAPI = getAgentAPI();
  this.agentRegistry = new AgentRegistry();
  this.routingLayer = new AgentRoutingLayer(this.agentRegistry);
  this.circuitBreakers = new CircuitBreakerManager();
  
  // ADD THESE:
  this.llmGateway = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
  this.memorySystem = new MemorySystem(supabase, this.llmGateway);
}
```

---

## 3. Add Simulation Method

Add after the `executeWorkflow` method:

```typescript
/**
 * Simulate workflow execution without actually running it
 * Uses LLM to predict outcomes based on similar past episodes
 */
async simulateWorkflow(
  workflowDefinitionId: string,
  context: Record<string, any> = {},
  options?: {
    maxSteps?: number;
    stopOnFailure?: boolean;
  }
): Promise<SimulationResult> {
  if (!this.config.enableSimulation) {
    throw new Error('Simulation is disabled');
  }

  const simulationId = uuidv4();
  const startTime = Date.now();

  logger.info('Starting workflow simulation', {
    simulationId,
    workflowDefinitionId,
  });

  // Get workflow definition
  const { data: definition, error: defError } = await supabase
    .from('workflow_definitions')
    .select('*')
    .eq('id', workflowDefinitionId)
    .eq('is_active', true)
    .maybeSingle();

  if (defError || !definition) {
    throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
  }

  const dag: WorkflowDAG = definition.dag_schema as WorkflowDAG;

  // Retrieve similar past episodes for prediction
  const similarEpisodes = await this.memorySystem.retrieveSimilarEpisodes(
    context,
    5
  );

  // Simulate each stage
  const stepsSimulated: any[] = [];
  let currentStageId = dag.initial_stage;
  let simulationContext = { ...context };
  let stepNumber = 0;
  const maxSteps = options?.maxSteps || 50;
  let totalConfidence = 0;
  let successProbability = 1.0;

  while (currentStageId && stepNumber < maxSteps) {
    const stage = dag.stages.find((s) => s.id === currentStageId);
    if (!stage) break;

    stepNumber++;

    // Predict stage outcome using LLM
    const prediction = await this.predictStageOutcome(
      stage,
      simulationContext,
      similarEpisodes
    );

    stepsSimulated.push({
      stage_id: currentStageId,
      stage_name: stage.name,
      predicted_outcome: prediction.outcome,
      confidence: prediction.confidence,
      estimated_duration_seconds: prediction.estimatedDuration,
    });

    totalConfidence += prediction.confidence;
    successProbability *= prediction.confidence;

    // Update context with predicted outcome
    simulationContext = {
      ...simulationContext,
      ...prediction.outcome,
    };

    // Find next stage
    const transition = stage.transitions?.find((t) => {
      if (t.condition) {
        // Evaluate condition (simplified)
        return prediction.outcome.success !== false;
      }
      return true;
    });

    currentStageId = transition?.to_stage || null;

    if (dag.final_stages.includes(currentStageId || '')) {
      break;
    }
  }

  const duration = Date.now() - startTime;
  const avgConfidence = stepsSimulated.length > 0 ? totalConfidence / stepsSimulated.length : 0;

  // Assess risks
  const riskAssessment = {
    low_confidence_steps: stepsSimulated.filter(s => s.confidence < 0.7).length,
    estimated_cost_usd: stepsSimulated.length * 0.01, // Rough estimate
    requires_approval: stepsSimulated.some(s => s.stage_name.includes('delete') || s.stage_name.includes('remove')),
  };

  const result: SimulationResult = {
    simulation_id: simulationId,
    workflow_definition_id: workflowDefinitionId,
    predicted_outcome: simulationContext,
    confidence_score: avgConfidence,
    risk_assessment: riskAssessment,
    steps_simulated: stepsSimulated,
    duration_estimate_seconds: stepsSimulated.reduce((sum, s) => sum + s.estimated_duration_seconds, 0),
    success_probability: successProbability,
  };

  logger.info('Workflow simulation complete', {
    simulationId,
    stepsSimulated: stepsSimulated.length,
    confidence: avgConfidence,
    successProbability,
  });

  return result;
}

/**
 * Predict outcome of a single workflow stage
 */
private async predictStageOutcome(
  stage: WorkflowStage,
  context: Record<string, any>,
  similarEpisodes: any[]
): Promise<{
  outcome: Record<string, any>;
  confidence: number;
  estimatedDuration: number;
}> {
  // Use LLM to predict outcome based on stage description and similar episodes
  const prompt = `Predict the outcome of workflow stage: ${stage.name}
Description: ${stage.description || 'N/A'}
Context: ${JSON.stringify(context, null, 2)}
Similar past episodes: ${similarEpisodes.length}

Provide a JSON response with:
- outcome: predicted result object
- confidence: 0-1 score
- estimatedDuration: seconds`;

  try {
    const response = await this.llmGateway.complete({
      prompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.text);
    return {
      outcome: parsed.outcome || { success: true },
      confidence: parsed.confidence || 0.7,
      estimatedDuration: parsed.estimatedDuration || 5,
    };
  } catch (error) {
    logger.warn('Failed to predict stage outcome, using defaults', { error });
    return {
      outcome: { success: true },
      confidence: 0.5,
      estimatedDuration: 10,
    };
  }
}
```

---

## 4. Add Guardrails to executeDAGAsync

Update the `executeDAGAsync` method to include guardrails. Add this at the beginning of the while loop:

```typescript
private async executeDAGAsync(
  executionId: string,
  dag: WorkflowDAG,
  context: Record<string, any>,
  traceId: string
): Promise<void> {
  // ... existing code ...
  
  const autonomy = getAutonomyConfig();
  const startTime = this.executionStartTimes.get(executionId) || Date.now();
  this.executionStartTimes.set(executionId, startTime);
  
  while (currentStageId && !dag.final_stages.includes(currentStageId)) {
    // ADD GUARDRAILS HERE:
    await this.checkAutonomyGuardrails(executionId, currentStageId, context, startTime);
    
    // ... rest of existing code ...
  }
  
  // Cleanup
  this.executionStartTimes.delete(executionId);
}
```

---

## 5. Add Guardrails Method

Add this private method:

```typescript
/**
 * Check autonomy guardrails before executing stage
 */
private async checkAutonomyGuardrails(
  executionId: string,
  stageId: string,
  context: Record<string, any>,
  startTime: number
): Promise<void> {
  const autonomy = getAutonomyConfig();

  // Check kill switch
  if (autonomy.killSwitchEnabled) {
    throw new Error('Autonomy kill switch is enabled');
  }

  // Check duration limit
  const elapsed = Date.now() - startTime;
  if (elapsed > autonomy.maxDurationMs) {
    await this.handleWorkflowFailure(executionId, 'Autonomy guard: max duration exceeded');
    throw new Error('Autonomy guard: max duration exceeded');
  }

  // Check cost limit
  const cost = context.cost_accumulated_usd || 0;
  if (cost > autonomy.maxCostUsd) {
    await this.handleWorkflowFailure(executionId, 'Autonomy guard: max cost exceeded');
    throw new Error('Autonomy guard: max cost exceeded');
  }

  // Check destructive action approval
  if (autonomy.requireApprovalForDestructive) {
    const approvalState = context.approvals || {};
    const destructivePending = context.destructive_actions_pending as string[] | undefined;
    if (destructivePending && destructivePending.length > 0 && !approvalState[executionId]) {
      await this.handleWorkflowFailure(executionId, 'Approval required for destructive actions');
      throw new Error('Approval required for destructive actions');
    }
  }

  // Check per-agent autonomy level
  const agentLevels = autonomy.agentAutonomyLevels || {};
  const stageAgentId = context.current_agent_id;
  const level = stageAgentId ? agentLevels[stageAgentId] : undefined;
  if (level === 'observe') {
    await this.handleWorkflowFailure(executionId, `Agent ${stageAgentId} restricted to observe-only`);
    throw new Error('Autonomy guard: observe-only agent attempted action');
  }

  // Check agent kill switches
  const agentKillSwitches = autonomy.agentKillSwitches || {};
  if (stageAgentId && agentKillSwitches[stageAgentId]) {
    await this.handleWorkflowFailure(executionId, `Agent ${stageAgentId} is disabled by kill switch`);
    throw new Error('Autonomy guard: agent disabled');
  }

  // Check iteration limits
  const agentMaxIterations = autonomy.agentMaxIterations || {};
  const maxIterations = stageAgentId ? agentMaxIterations[stageAgentId] : undefined;
  if (maxIterations !== undefined) {
    const executed = (context.executed_steps || []).filter(
      (s: any) => s.agent_id === stageAgentId
    ).length;
    if (executed >= maxIterations) {
      await this.handleWorkflowFailure(executionId, `Agent ${stageAgentId} exceeded iteration limit`);
      throw new Error('Autonomy guard: iteration limit exceeded');
    }
  }

  logger.debug('Autonomy guardrails passed', { executionId, stageId });
}
```

---

## 6. Export SimulationResult

Make sure SimulationResult is exported at the top of the file (already done in step 1).

---

## Implementation Status

- ✅ SimulationResult type added
- ✅ Imports added (autonomy, MemorySystem, LLMGateway)
- ⏳ Class properties need to be added
- ⏳ Constructor needs to be updated
- ⏳ simulateWorkflow method needs to be added
- ⏳ predictStageOutcome method needs to be added
- ⏳ checkAutonomyGuardrails method needs to be added
- ⏳ executeDAGAsync needs guardrails integration

---

## Testing

After implementation:

```bash
# Test simulation
npm test -- UnifiedAgentOrchestrator.test.ts

# Test guardrails
npm test -- --grep "guardrail"

# Test full workflow with guardrails
npm test -- --grep "workflow.*autonomy"
```

---

## Files to Update After Merge

1. `src/components/Workflow/WorkflowErrorPanel.tsx` - Use UnifiedAgentOrchestrator
2. `src/services/PlaygroundWorkflowAdapter.ts` - Use UnifiedAgentOrchestrator
3. `src/services/WorkflowLifecycleIntegration.ts` - Use UnifiedAgentOrchestrator

---

## Notes

- Simulation uses LLM to predict outcomes (requires LLM API key)
- Guardrails are checked before each workflow stage
- Autonomy config is loaded from `src/config/autonomy.ts`
- Memory system is used for retrieving similar episodes
- All guardrail violations are logged and cause workflow failure

---

**Status:** Documentation complete, ready for implementation  
**Estimated Time:** 4-6 hours for full implementation and testing
