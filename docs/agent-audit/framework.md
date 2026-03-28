# Agent Audit Framework - ValueOS

## Per-Agent Checklist (OneUptime Standards)

### 1. Purpose Alignment
- [ ] Agent has clear, documented purpose
- [ ] Executes actual business logic (not just mocks)
- [ ] Output schema validated with Zod
- [ ] hallucination_check field in response schema

### 2. Hardening
- [ ] Uses secureInvoke (not direct LLMGateway.complete)
- [ ] Circuit breaker integration
- [ ] Kill switch check before execution
- [ ] Input validation (Zod schemas)
- [ ] Output validation (Zod schemas)
- [ ] Retry logic with exponential backoff
- [ ] Timeout handling
- [ ] Tenant isolation (organization_id filtering)

### 3. Testing Quality
- [ ] Unit tests with mocked dependencies
- [ ] Integration tests with real services (where safe)
- [ ] Graph tests for workflow DAG validation
- [ ] Persistence tests for memory/lineage
- [ ] Security tests (injection, prompt escaping)
- [ ] No hardcoded mock data in production code
- [ ] Tests verify actual behavior, not just mocks

### 4. Observability
- [ ] Structured logging
- [ ] Execution lineage tracking
- [ ] Memory persistence
- [ ] Error reporting with context

### 5. Vals (Validation Layers)
- [ ] Pre-execution validation (inputs)
- [ ] Post-execution validation (outputs)
- [ ] Ground truth verification (MCP)
- [ ] Confidence thresholds enforced

## Agents to Audit

1. OpportunityAgent - discovers value opportunities
2. TargetAgent - defines target metrics
3. FinancialModelingAgent - builds financial models
4. IntegrityAgent - validates model integrity
5. RealizationAgent - tracks realization
6. ExpansionAgent - identifies expansion opportunities
7. NarrativeAgent - generates narratives
8. ComplianceAuditorAgent - compliance checking
9. ContextExtractionAgent - extracts context
10. DealAssemblyAgent - assembles deals
11. DiscoveryAgent - discovery phase
