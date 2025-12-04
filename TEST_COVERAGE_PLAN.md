# Test Coverage Plan

## Current Status: 22% (119/530 files)
## Target: 60% (318 files) by Phase 2

---

## 🎯 PRIORITY 1: CRITICAL PATHS (Week 1)

### Agent Fabric (0% → 80%)
**Impact**: Core business logic
**Files**: 15 agent files, 0 tests

Must test:
- [ ] `OpportunityAgent.test.ts` - Discovery analysis
- [ ] `TargetAgent.test.ts` - Business case generation  
- [ ] `RealizationAgent.test.ts` - Value tracking
- [ ] `BaseAgent.test.ts` - Secure invocation
- [ ] `LLMGateway.test.ts` - Model routing & fallback

### Authentication & Authorization (40% → 90%)
**Impact**: Security foundation
**Files**: 8 files, 3 tests

Must test:
- [ ] `AuthService.test.ts` - Signup, login, MFA
- [ ] `RBAC.test.ts` - Role-based access
- [ ] `SessionManager.test.ts` - Token refresh

### Multi-Tenancy (60% → 95%)
**Impact**: Data isolation (GR-010)
**Files**: 10 files, 6 tests

Must test:
- [ ] `TenantMiddleware.test.ts` - Context injection
- [ ] `BaseService.test.ts` - RLS enforcement
- [ ] All repositories - Tenant filtering

---

## 🎯 PRIORITY 2: HIGH-VALUE SERVICES (Week 2)

### Workflow Orchestration (20% → 70%)
- [ ] `WorkflowOrchestrator.test.ts` - DAG execution
- [ ] `SagaPattern.test.ts` - Compensation logic
- [ ] `CircuitBreaker.test.ts` - Failure handling

### Value Lifecycle (0% → 60%)
- [ ] `ValueCaseService.test.ts` - CRUD operations
- [ ] `ModelService.test.ts` - Business case persistence
- [ ] `ROICalculator.test.ts` - Formula evaluation

### Memory System (0% → 50%)
- [ ] `MemorySystem.test.ts` - Vector search
- [ ] `ConversationHistory.test.ts` - Context management

---

## 🎯 PRIORITY 3: UI & INTEGRATION (Week 3-4)

### React Components (10% → 40%)
- Focus on container components with logic
- Skip presentational components initially

### API Routes (0% → 50%)
- [ ] Integration tests for critical endpoints
- [ ] Error handling paths

---

## 📋 TEST TEMPLATES CREATED

1. **Agent Test Template** - `src/lib/agent-fabric/agents/__tests__/AgentTestTemplate.ts`
2. **Service Test Template** - `src/services/__tests__/ServiceTestTemplate.ts`
3. **Repository Test Template** - `src/repositories/__tests__/RepositoryTestTemplate.ts`

---

## 🛠️ TESTING STRATEGY

### Unit Tests (60% of coverage)
```typescript
// Test in isolation with mocks
describe('OpportunityAgent', () => {
  it('should extract pain points from discovery data', async () => {
    const mockLLM = vi.fn().mockResolvedValue({ content: '...' });
    const agent = new OpportunityAgent({ llmGateway: mockLLM });
    
    const result = await agent.execute(sessionId, input);
    
    expect(result.painPoints).toHaveLength(3);
    expect(mockLLM).toHaveBeenCalledWith(...);
  });
});
```

### Integration Tests (30% of coverage)
```typescript
// Test with real database (Supabase local)
describe('ValueCaseService Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });
  
  it('should create value case with RLS enforcement', async () => {
    const service = new ValueCaseService(orgId);
    const valueCase = await service.create({ ... });
    
    // Verify tenant isolation
    const otherOrg = new ValueCaseService(differentOrgId);
    await expect(otherOrg.getById(valueCase.id)).rejects.toThrow();
  });
});
```

### E2E Tests (10% of coverage)
```typescript
// Test full workflows with Playwright
test('Value case creation flow', async ({ page }) => {
  await page.goto('/value-cases/new');
  await page.fill('[name="title"]', 'Test Case');
  await page.click('button:has-text("Create")');
  
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## 📊 METRICS TO TRACK

```bash
# Generate coverage report
npm test -- --coverage

# Watch specific paths
npm test -- --watch src/lib/agent-fabric

# Coverage by category
npm test -- --coverage --collectCoverageFrom="src/lib/agent-fabric/**/*.ts"
```

### Success Criteria:
- **Line Coverage**: 60%+
- **Branch Coverage**: 50%+
- **Function Coverage**: 65%+
- **Critical Paths**: 80%+

---

## 🚀 QUICK WINS

Start here (1-2 hours):
1. `OpportunityAgent.test.ts` - Use template
2. `AuthService.test.ts` - Security critical
3. `TenantMiddleware.test.ts` - Multi-tenancy

---

## 🔧 COMMANDS

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Run specific file
npm test OpportunityAgent.test.ts

# Run specific test
npm test -- -t "should extract pain points"
```
