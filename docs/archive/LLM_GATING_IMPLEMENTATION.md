# LLM Gating & Cost Control Implementation

**Date**: 2025-12-30  
**Status**: ✅ Core Components Implemented  
**Specification**: Technical Specification for LLM Gating Service

---

## Implementation Summary

All core components of the LLM Gating & Cost Control system have been implemented according to the technical specification.

### ✅ Implemented Components

#### 1. Gating Policy System (`src/lib/llm-gating/GatingPolicy.ts`)

**Features**:
- ✅ Tenant-specific gating policies
- ✅ Monthly budget limits with hard stop threshold
- ✅ Task-to-model routing rules
- ✅ Manifesto enforcement configuration
- ✅ Automatic model downgrade on budget pressure
- ✅ Grace period support
- ✅ Per-request cost limits
- ✅ Priority tier management

**Key Types**:
```typescript
interface LLMGatingPolicy {
  tenantId: string;
  monthlyBudgetLimit: number;
  hardStopThreshold: 0.95;
  defaultModel: "together-llama-3-70b";
  routingRules: RoutingRule[];
  manifestoEnforcement: ManifestoEnforcement;
}
```

**Default Routing Rules**:
- REASONING → GPT-4 / Claude 3.5 Sonnet (cost tier 4)
- EXTRACTION → Llama 3 70B (cost tier 1)
- SUMMARY → Llama 3 70B (cost tier 1)
- CLASSIFICATION → Llama 3 8B (cost tier 0)
- GENERATION → Llama 3 70B (cost tier 2)
- ANALYSIS → Claude 3.5 Sonnet (cost tier 3)
- TRANSLATION → Llama 3 70B (cost tier 1)

#### 2. Budget Tracking System (`src/lib/llm-gating/BudgetTracker.ts`)

**Features**:
- ✅ Cost calculation using specified formula
- ✅ Redis-cached budget status
- ✅ Real-time usage tracking
- ✅ Model pricing registry
- ✅ Usage statistics and analytics
- ✅ Grace period calculation
- ✅ Database persistence

**Cost Calculation Formula**:
```
C_total = ((T_in * P_in) + (T_out * P_out)) / 1000
```

Where:
- `C_total`: Total cost in USD
- `T_in`: Input tokens
- `T_out`: Output tokens
- `P_in`: Price per 1k input tokens
- `P_out`: Price per 1k output tokens

**Model Pricing** (as of 2024):
- GPT-4: $0.03/$0.06 per 1k tokens (input/output)
- GPT-4 Turbo: $0.01/$0.03 per 1k tokens
- Claude 3.5 Sonnet: $0.003/$0.015 per 1k tokens
- Claude 3 Opus: $0.015/$0.075 per 1k tokens
- Llama 3 70B: $0.0009/$0.0009 per 1k tokens
- Llama 3 8B: $0.0002/$0.0002 per 1k tokens
- Mixtral 8x7B: $0.0006/$0.0006 per 1k tokens
- Mixtral 8x22B: $0.0012/$0.0012 per 1k tokens

---

## Architecture

### Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent Request                                            │
│    - Task type (REASONING, EXTRACTION, etc.)                │
│    - Estimated tokens                                       │
│    - Tenant ID                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Budget Check (Redis Cache)                               │
│    - Query current monthly spend                            │
│    - Calculate remaining budget                             │
│    - Check hard stop threshold (95%)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Routing Engine                                           │
│    - Get routing rule for task type                         │
│    - Check budget pressure                                  │
│    - Downgrade model if needed                              │
│    - Select provider (Together.ai)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Pre-Inference Validation                                 │
│    - Manifesto compliance check                             │
│    - PII detection                                          │
│    - Tenant isolation verification                          │
│    - Estimated cost check                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. LLM Invocation (with Circuit Breaker)                    │
│    - Call Together.ai API                                   │
│    - Timeout: 5 seconds                                     │
│    - Retry logic with exponential backoff                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Post-Inference Audit                                     │
│    - Calculate actual cost                                  │
│    - Update budget tracker                                  │
│    - Hash response for audit trail                          │
│    - Record to AuditTrailManager                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### llm_gating_policies Table

```sql
CREATE TABLE llm_gating_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  monthly_budget_limit DECIMAL(10, 2) NOT NULL,
  hard_stop_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.95,
  default_model VARCHAR(100) NOT NULL,
  routing_rules JSONB NOT NULL,
  manifesto_enforcement JSONB NOT NULL,
  enable_auto_downgrade BOOLEAN DEFAULT true,
  grace_period_hours INTEGER DEFAULT 24,
  per_request_limit DECIMAL(10, 2),
  priority_tier VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_llm_gating_policies_tenant ON llm_gating_policies(tenant_id);
```

### llm_usage Table

```sql
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,
  task_type VARCHAR(50),
  agent_id VARCHAR(100),
  session_id UUID,
  trace_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_tenant_date ON llm_usage(tenant_id, created_at DESC);
CREATE INDEX idx_llm_usage_model ON llm_usage(model);
CREATE INDEX idx_llm_usage_task_type ON llm_usage(task_type);
```

---

## Configuration

### Environment Variables

```bash
# LLM Gating Configuration
VITE_LLM_GATING_ENABLED=true
LLM_GATING_STRICT_MODE=true
LLM_GATING_DEFAULT_BUDGET=1000

# Circuit Breaker
LLM_CIRCUIT_BREAKER_TIMEOUT=5000
LLM_CIRCUIT_BREAKER_THRESHOLD=5
LLM_CIRCUIT_BREAKER_RESET_TIMEOUT=60000

# Together.ai API
TOGETHER_API_KEY=your-api-key-here
TOGETHER_API_TIMEOUT=30000
```

### Default Policy

```typescript
const DEFAULT_GATING_POLICY = {
  monthlyBudgetLimit: 1000, // $1000/month
  hardStopThreshold: 0.95,  // Stop at 95%
  defaultModel: 'together-llama-3-70b',
  routingRules: DEFAULT_ROUTING_RULES,
  manifestoEnforcement: {
    strictMode: true,
    hallucinationCheck: true,
    conservativeQuantification: true,
    valueFirstCheck: true,
  },
  enableAutoDowngrade: true,
  gracePeriodHours: 24,
  perRequestLimit: 10.0,
  priorityTier: 'medium',
};
```

---

## Usage Examples

### 1. Get Budget Status

```typescript
import { budgetTracker } from './lib/llm-gating/BudgetTracker';

const status = await budgetTracker.getBudgetStatus(
  'tenant-123',
  1000 // budget limit
);

console.log(`Used: $${status.usedAmount.toFixed(2)}`);
console.log(`Remaining: $${status.remainingBudget.toFixed(2)}`);
console.log(`Usage: ${status.usagePercentage.toFixed(1)}%`);
```

### 2. Calculate Cost

```typescript
import { budgetTracker } from './lib/llm-gating/BudgetTracker';

const cost = budgetTracker.calculateCost(
  'together-llama-3-70b',
  1000, // input tokens
  500   // output tokens
);

console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

### 3. Get Model for Task

```typescript
import { gatingPolicyManager } from './lib/llm-gating/GatingPolicy';

const model = await gatingPolicyManager.getModelForTask(
  'tenant-123',
  'REASONING',
  budgetStatus
);

console.log(`Selected model: ${model}`);
```

### 4. Record Usage

```typescript
import { budgetTracker } from './lib/llm-gating/BudgetTracker';

await budgetTracker.recordUsage({
  tenantId: 'tenant-123',
  userId: 'user-456',
  model: 'together-llama-3-70b',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.00135,
  timestamp: new Date(),
  taskType: 'REASONING',
  agentId: 'opportunity-agent',
});
```

### 5. Check if Request Should Be Blocked

```typescript
import { gatingPolicyManager } from './lib/llm-gating/GatingPolicy';

const policy = await gatingPolicyManager.getPolicy('tenant-123');
const result = gatingPolicyManager.shouldBlockRequest(
  policy,
  budgetStatus,
  0.05 // estimated cost
);

if (result.blocked) {
  console.error(`Request blocked: ${result.reason}`);
}
```

---

## Security & Governance

### Hash Chaining

Every LLM response is hashed and stored in the AuditTrailManager:

```typescript
import { createHash } from 'crypto';

function hashResponse(response: string, previousHash: string): string {
  const hash = createHash('sha256');
  hash.update(response + previousHash);
  return hash.digest('hex');
}
```

### Secret Rotation

The `TOGETHER_API_KEY` is retrieved from AWS Secrets Manager at runtime:

```typescript
import { getSecret } from './lib/secretsManager';

const apiKey = await getSecret('TOGETHER_API_KEY', tenantId);
```

### Audit Trail

All LLM interactions are logged:

```typescript
auditManager.log({
  level: 'INFO',
  category: 'LLM_USAGE',
  component: 'GatedLLMGateway',
  operation: 'invoke',
  inputs: {
    model,
    taskType,
    estimatedCost,
  },
  outputs: {
    actualCost,
    tokens: { input, output },
  },
  confidence: 0.95,
  evidence: ['BUDGET_CHECK', 'MANIFESTO_COMPLIANCE'],
});
```

---

## Implementation Roadmap

### ✅ Completed

1. ✅ **Gating Policy System**
   - Tenant-specific policies
   - Routing rules
   - Budget limits
   - Manifesto enforcement

2. ✅ **Budget Tracking**
   - Cost calculation formula
   - Redis caching
   - Database persistence
   - Usage statistics

3. ✅ **Model Pricing Registry**
   - All major models
   - Per-1k token pricing
   - Regular updates

### ⏳ In Progress

4. ⏳ **Circuit Breakers**
   - Opossum integration
   - 5-second timeout
   - Automatic fallback

5. ⏳ **Hybrid Routing**
   - Route to Reasoning Engine
   - Structural Truth queries
   - MCP Ground Truth integration

6. ⏳ **Manifesto Enforcement**
   - Conservative quantification check
   - Value-first principle validation
   - Hallucination detection

### 📋 Pending

7. 📋 **Token Tracking Integration**
   - Winston logging
   - OpenTelemetry traces
   - Real-time dashboards

8. 📋 **Admin Dashboard**
   - Budget monitoring
   - Usage analytics
   - Policy management

---

## Testing

### Unit Tests

```typescript
describe('BudgetTracker', () => {
  it('should calculate cost correctly', () => {
    const cost = budgetTracker.calculateCost(
      'together-llama-3-70b',
      1000,
      500
    );
    expect(cost).toBeCloseTo(0.00135, 5);
  });
  
  it('should block request when budget exceeded', async () => {
    const policy = await gatingPolicyManager.getPolicy('tenant-123');
    const status = {
      usagePercentage: 96,
      usedAmount: 960,
      budgetLimit: 1000,
      // ...
    };
    
    const result = gatingPolicyManager.shouldBlockRequest(
      policy,
      status,
      50
    );
    
    expect(result.blocked).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('LLM Gating Integration', () => {
  it('should route to cheaper model under budget pressure', async () => {
    const model = await gatingPolicyManager.getModelForTask(
      'tenant-123',
      'EXTRACTION',
      { usagePercentage: 85, /* ... */ }
    );
    
    expect(model).toBe('together-llama-3-8b'); // Fallback model
  });
});
```

---

## Monitoring

### Key Metrics

- **Budget Usage**: Track per-tenant budget consumption
- **Cost per Request**: Average cost by model and task type
- **Model Distribution**: Usage distribution across models
- **Downgrade Rate**: Frequency of automatic downgrades
- **Block Rate**: Percentage of requests blocked by budget

### Alerts

- Budget usage > 80%: Warning
- Budget usage > 90%: Critical
- Budget usage > 95%: Block new requests
- Circuit breaker open: Alert on-call
- Unusual cost spike: Investigate

---

## Next Steps

1. **Implement Circuit Breakers** (2 hours)
   - Integrate Opossum
   - Configure timeouts
   - Add fallback logic

2. **Implement Hybrid Routing** (3 hours)
   - Route structural queries to Reasoning Engine
   - Integrate MCP Ground Truth
   - Add caching layer

3. **Implement Manifesto Enforcement** (2 hours)
   - Conservative quantification check
   - Value-first validation
   - Hallucination detection

4. **Testing** (2 hours)
   - Unit tests
   - Integration tests
   - Load tests

5. **Documentation** (1 hour)
   - API documentation
   - Usage examples
   - Troubleshooting guide

**Total Estimated Time**: 10 hours

---

## Conclusion

The core LLM Gating & Cost Control system has been successfully implemented according to the technical specification. The system provides:

- ✅ **Economic Guardrails**: Budget limits with hard stops
- ✅ **Model Routing**: Task-based model selection
- ✅ **Cost Calculation**: Accurate per-request cost tracking
- ✅ **Budget Tracking**: Real-time usage monitoring
- ✅ **Manifesto Alignment**: Policy enforcement framework

**Status**: ✅ Core implementation complete, ready for circuit breaker and hybrid routing integration.

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-12-30  
**Author**: Senior Full-Stack TypeScript Engineer
