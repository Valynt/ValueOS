# Architecture Compliance Fixes Plan

This plan addresses two critical architectural violations identified in the ValueOS audit: SecureMessageBus bypass in inter-agent communication and missing Causal Truth integration in the Opportunity→Target agent data flow.

## Issues Summary

1. **SecureMessageBus Bypass**: UnifiedAgentOrchestrator uses `agentAPI.callAgent()` instead of BaseAgent's `sendToAgent()` for inter-agent communication
2. **Missing Causal Truth**: OpportunityAgent and TargetAgent don't leverage the existing causal truth database for evidence-based value predictions

## Fix 1: SecureMessageBus Integration

### Problem Location

- File: `src/services/UnifiedAgentOrchestrator.ts`
- Method: `executeStage()` (line 929-953)
- Issue: Direct call to `this.agentAPI.callAgent()` bypasses SecureMessageBus

### Solution Approach

1. **Create AgentMessageBroker**: New service to handle SecureMessageBus communication between agents
2. **Modify UnifiedAgentOrchestrator**: Replace direct agentAPI calls with SecureMessageBus messaging
3. **Update Agent Registry**: Ensure agents are discoverable via SecureMessageBus IDs

### Implementation Steps

1. Create `src/services/AgentMessageBroker.ts` with:
   - `sendAgentMessage()` method using BaseAgent.sendToAgent()
   - Message routing and response handling
   - Timeout and retry logic

2. Modify `UnifiedAgentOrchestrator.executeStage()`:
   - Replace `agentAPI.callAgent()` with `messageBroker.sendAgentMessage()`
   - Handle async message responses
   - Maintain existing error handling and circuit breaker patterns

3. Update agent registration to include SecureMessageBus IDs in AgentRegistry

## Fix 2: Causal Truth Integration

### Problem Location

- Files: `src/lib/agent-fabric/agents/OpportunityAgent.ts` and `TargetAgent.ts`
- Issue: No integration with existing causal truth data structures

### Solution Approach

1. **Create CausalTruthService**: Service layer to expose causal truth database to agents
2. **Enhance OpportunityAgent**: Use causal evidence for pain point validation and impact estimation
3. **Enhance TargetAgent**: Ground ROI models in proven causal relationships

### Implementation Steps

1. Create `src/services/CausalTruthService.ts`:
   - Load and index `casual/data/causal_truth_db.json`
   - Provide `getCausalImpact()` and `getEvidenceSources()` methods
   - Cache frequently accessed relationships

2. Update OpportunityAgent:
   - Add CausalTruthService dependency
   - Validate pain points against known causal impacts
   - Include evidence sources in opportunity analysis
   - Calibrate confidence scores based on causal truth data

3. Update TargetAgent:
   - Add CausalTruthService dependency
   - Ground ROI assumptions in proven causal mechanisms
   - Include cascading effects in financial models
   - Reference specific evidence from causal truth database

4. Update agent constructors to accept CausalTruthService configuration

## Implementation Order

1. **Phase 1**: Create CausalTruthService (independent, lower risk)
2. **Phase 2**: Integrate CausalTruthService into OpportunityAgent and TargetAgent
3. **Phase 3**: Create AgentMessageBroker service
4. **Phase 4**: Update UnifiedAgentOrchestrator to use SecureMessageBus
5. **Phase 5**: Testing and validation of both fixes

## Testing Strategy

### SecureMessageBus Testing

- Unit tests for AgentMessageBroker
- Integration tests for message flow between agents
- Verify audit trail logging for inter-agent communication
- Test error handling and message delivery failures

### Causal Truth Testing

- Unit tests for CausalTruthService data loading and querying
- Integration tests for agent predictions using causal evidence
- Validate confidence score calibration
- Test edge cases (missing causal data, conflicting evidence)

## Risk Mitigation

### SecureMessageBus Risks

- **Message Delivery Failures**: Implement retry logic and fallback to direct API calls
- **Performance Overhead**: Benchmark message broker vs direct calls
- **Backward Compatibility**: Ensure existing workflows continue functioning

### Causal Truth Risks

- **Data Availability**: Graceful degradation when causal data is missing
- **Performance**: Implement caching for causal truth queries
- **Prediction Changes**: Monitor impact on agent outputs and confidence scores

## Success Criteria

1. All inter-agent communication flows through SecureMessageBus
2. OpportunityAgent and TargetAgent reference causal evidence in predictions
3. Audit trails show complete message provenance
4. Agent confidence scores are grounded in empirical evidence
5. No performance regression in agent execution times

## Files to Modify

### New Files

- `src/services/AgentMessageBroker.ts`
- `src/services/CausalTruthService.ts`

### Modified Files

- `src/services/UnifiedAgentOrchestrator.ts`
- `src/lib/agent-fabric/agents/OpportunityAgent.ts`
- `src/lib/agent-fabric/agents/TargetAgent.ts`
- `src/services/AgentRegistry.ts` (minimal changes)

### Test Files

- New unit tests for both services
- Updated integration tests for orchestrator and agents
