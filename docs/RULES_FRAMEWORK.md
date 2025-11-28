# ValueCanvas Rules Framework

## Enterprise Agentic SaaS Policy-as-Code

This document describes the Rules Framework for ValueCanvas, providing enterprise-grade safety, compliance, and governance for the multi-agent system.

---

## Overview

The ValueCanvas Rules Framework implements a two-tier policy system:

| Tier | Name | Scope | Purpose |
|------|------|-------|---------|
| **Global Rules** | Platform "Constitution" | All agents, all tenants | Immutable safety and compliance |
| **Local Rules** | Agent "Job Description" | Specific agents/tenants | Behavioral control and workflows |

### Design Principles

1. **Safe Simulation** - Test production constraints without production risks
2. **Tenant Isolation** - Ensure no cross-data pollination
3. **Rapid Iteration** - Allow developers to break things safely
4. **Defense in Depth** - Multiple layers of protection

---

## Quick Start

### Basic Usage

```typescript
import { enforceRules, isActionAllowed } from '@/lib/rules';

// Quick check
const allowed = await isActionAllowed({
  agentId: 'agent-123',
  agentType: 'coordinator',
  userId: 'user-456',
  tenantId: 'tenant-789',
  sessionId: 'session-abc',
  action: 'build_value_tree',
  payload: { /* action data */ },
  environment: 'development',
});

// Full enforcement with details
const result = await enforceRules({
  agentId: 'agent-123',
  agentType: 'outcome_engineer',
  userId: 'user-456',
  tenantId: 'tenant-789',
  sessionId: 'session-abc',
  action: 'calculate_roi',
  tool: 'generate_roi_model',
  payload: { roiProjection: 150000 },
});

if (!result.allowed) {
  console.log('Violations:', result.violations);
  console.log('User messages:', result.userMessages);
  console.log('Fallback actions:', result.fallbackActions);
}
```

### Integration with Agents

```typescript
import { getRulesEnforcer, buildGlobalRuleContext, buildLocalRuleContext } from '@/lib/rules';

class MyAgent {
  private enforcer = getRulesEnforcer({ environment: 'production' });

  async executeAction(action: string, payload: any) {
    const globalContext = buildGlobalRuleContext({
      agentId: this.id,
      agentType: 'coordinator',
      userId: this.userId,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      action,
      payload,
    });

    const localContext = buildLocalRuleContext({
      agentId: this.id,
      agentType: 'coordinator',
      // ... other context
    });

    const result = await this.enforcer.enforce(globalContext, localContext);
    
    if (!result.allowed) {
      throw new PolicyViolationError(result.violations);
    }

    return this.performAction(action, payload);
  }
}
```

---

## Global Rules (Platform Constitution)

Global rules are **immutable safety constraints** applied to ALL agents across the platform. They cannot be overridden by local rules.

### Categories

#### 1. Systemic Safety

| Rule ID | Name | Description | Severity |
|---------|------|-------------|----------|
| GR-001 | Block Dangerous Commands | Blocks DROP TABLE, rm -rf, sudo, etc. | Critical |
| GR-002 | Network Allowlist | Blocks non-allowlisted outbound traffic | Critical |
| GR-003 | Recursion Limit | Prevents infinite loops (max 5-10 depth) | High |

**Example: GR-001 Detection**
```typescript
// BLOCKED - dangerous SQL pattern
const payload = { query: "DROP TABLE users;" };
// Result: { passed: false, message: "Dangerous command pattern detected" }

// ALLOWED - safe query
const payload = { query: "SELECT * FROM users WHERE tenant_id = $1" };
// Result: { passed: true }
```

#### 2. Data Sovereignty

| Rule ID | Name | Description | Severity |
|---------|------|-------------|----------|
| GR-010 | Tenant Isolation | All queries must include tenant_id | Critical |
| GR-011 | Cross-Tenant Transfer | Blocks data transfer between tenants | Critical |

**Example: GR-010 Enforcement**
```typescript
// BLOCKED - missing tenant isolation
const action = "query";
const payload = { table: "value_trees", filters: {} };
// Result: { passed: false, message: "Database operation missing tenant_id filter" }

// ALLOWED - proper tenant isolation
const payload = { table: "value_trees", filters: { tenant_id: "tenant-123" } };
// Result: { passed: true }
```

#### 3. PII Protection

| Rule ID | Name | Description | Severity |
|---------|------|-------------|----------|
| GR-020 | PII Detection | Blocks SSN, credit cards, etc. | Critical |
| GR-021 | Logging PII | Prevents PII in logs | High |

**Detected Patterns:**
- Social Security Numbers: `XXX-XX-XXXX`
- Credit Cards: Visa, MasterCard, Amex patterns
- Phone Numbers: US format
- Bulk Email Lists

#### 4. Cost Control

| Rule ID | Name | Description | Severity |
|---------|------|-------------|----------|
| GR-030 | Loop Step Limit | Max 10-20 reasoning steps | High |
| GR-031 | Session Cost | Max $5-$25 per session | High |
| GR-032 | Execution Time | Max 30-60 seconds | High |

**Environment Limits:**
```yaml
development:
  maxSteps: 20
  maxLLMCalls: 50
  maxSessionCost: $5.00
  maxExecutionTime: 60s

production:
  maxSteps: 10
  maxLLMCalls: 20
  maxSessionCost: $25.00
  maxExecutionTime: 30s
```

---

## Local Rules (Agent Job Descriptions)

Local rules define **specific behaviors** for individual agent types. They can be customized per tenant.

### Categories

#### 1. Scope of Authority

Controls which tools each agent can access.

| Rule ID | Name | Description |
|---------|------|-------------|
| LR-001 | Tool Access Control | Allow/deny lists per agent |
| LR-002 | Delegation Control | Controls agent-to-agent delegation |

**Tool Access Matrix:**

| Agent | Allowed Tools | Denied Tools |
|-------|--------------|--------------|
| Coordinator | plan_task, delegate_to_agent, summarize_results | execute_sql, modify_system_config |
| Outcome Engineer | build_value_tree, calculate_projections | modify_financial_records |
| Communicator | send_message, format_report | send_external_email |

**Delegation Matrix:**
```
Coordinator → [All Agents]
System Mapper → [Communicator]
Outcome Engineer → [Value Eval, Communicator]
Realization Loop → [Outcome Engineer, Communicator]
```

#### 2. Behavioral Alignment

Ensures agents maintain consistent persona and quality.

| Rule ID | Name | Description |
|---------|------|-------------|
| LR-010 | Response Quality | Blocks unhelpful/hyperbolic responses |
| LR-011 | Persona Enforcement | Maintains professional tone |
| LR-012 | Uncertainty Handling | Requires clarification when unsure |

**Blocked Patterns:**
```typescript
// Unhelpful responses
"I don't know."
"I can't help with that."

// Hyperbolic language
"revolutionary", "game-changing", "guaranteed"

// Persona violations
"I think...", "I feel...", "gonna", "wanna"
```

#### 3. Workflow Logic

Validates business process rules.

| Rule ID | Name | Description |
|---------|------|-------------|
| LR-020 | Stage Transition | Validates workflow progression |
| LR-021 | Approval Workflow | Requires approval for high-value actions |
| LR-022 | Prerequisite Validation | Ensures steps are completed in order |

**Valid Stage Transitions:**
```
opportunity → target
target → expansion | opportunity
expansion → integrity | target
integrity → realization | expansion
realization → integrity
```

**Approval Thresholds:**
- Expense > $500 → Requires approval
- ROI Projection > $100,000 → Requires approval
- Risk Score > 0.7 → Requires approval

#### 4. Error Handling

Defines graceful degradation behavior.

| Rule ID | Name | Description |
|---------|------|-------------|
| LR-030 | Graceful Degradation | Fallback behaviors per service |
| LR-031 | Retry Policy | Max retries and non-retryable errors |

**Fallback Messages:**
```typescript
{
  calendar_api: "I cannot schedule meetings right now.",
  database: "Let me try an alternative approach.",
  llm_service: "Let me try a simpler approach.",
  external_api: "I'll proceed with available information."
}
```

---

## Configuration

### Environment Configuration

```typescript
import { getRulesEnforcer } from '@/lib/rules';

// Development (relaxed limits)
const devEnforcer = getRulesEnforcer({
  environment: 'development',
  strictMode: false,
  auditMode: false,
});

// Production (strict enforcement)
const prodEnforcer = getRulesEnforcer({
  environment: 'production',
  strictMode: true,
  auditMode: false,
});

// Audit Mode (log but don't block)
const auditEnforcer = getRulesEnforcer({
  environment: 'production',
  strictMode: true,
  auditMode: true,  // Violations logged but not enforced
});
```

### Tenant Overrides

```typescript
const enforcer = getRulesEnforcer({
  tenantOverrides: {
    tenantId: 'enterprise-tenant',
    disabledRules: ['GR-003'],  // Allow deeper recursion
    customThresholds: {
      maxLoopSteps: 25,
      maxSessionCost: 50.00,
    },
  },
});
```

### YAML Configuration

See `src/lib/rules/rules.config.yaml` for declarative rule configuration:

```yaml
globalRules:
  - id: GR-001
    name: Block Dangerous System Commands
    category: systemic_safety
    severity: critical
    enabled: true
    enforcementMode: block
    devOverridable: false
```

---

## Enforcement Results

### Result Structure

```typescript
interface EnforcementResult {
  allowed: boolean;
  globalResults: RuleCheckResult[];
  localResults: LocalRuleCheckResult[];
  violations: RuleViolation[];
  warnings: RuleWarning[];
  fallbackActions: string[];
  userMessages: string[];
  executionTimeMs: number;
  metadata: {
    globalRulesChecked: number;
    localRulesChecked: number;
    timestamp: number;
    requestId: string;
  };
}
```

### Violation Structure

```typescript
interface RuleViolation {
  ruleId: string;        // e.g., "GR-010"
  ruleName: string;      // e.g., "Tenant Isolation Enforcement"
  category: string;      // e.g., "data_sovereignty"
  severity: string;      // "critical" | "high" | "medium" | "low"
  message: string;       // Human-readable description
  details?: object;      // Additional context
  remediation?: string;  // How to fix
}
```

---

## Metrics & Monitoring

### Access Metrics

```typescript
const enforcer = getRulesEnforcer();
const metrics = enforcer.getAggregatedMetrics();

console.log({
  totalChecks: metrics.totalChecks,
  passRate: metrics.overallPassRate,
  ruleBreakdown: metrics.ruleBreakdown,
});
```

### Enforcement History

```typescript
const history = enforcer.getEnforcementHistory(sessionId);
// Returns last 100 enforcement results for the session
```

---

## Testing

### Unit Testing Rules

```typescript
import { 
  RULE_TENANT_ISOLATION, 
  buildGlobalRuleContext 
} from '@/lib/rules';

describe('GR-010: Tenant Isolation', () => {
  it('should block queries without tenant_id', () => {
    const context = buildGlobalRuleContext({
      action: 'query',
      payload: { table: 'users' },
      // missing tenant_id
    });

    const result = RULE_TENANT_ISOLATION.check(context);
    expect(result.passed).toBe(false);
  });

  it('should allow queries with tenant_id', () => {
    const context = buildGlobalRuleContext({
      action: 'query',
      payload: { 
        table: 'users',
        filters: { tenant_id: 'tenant-123' },
      },
      tenantId: 'tenant-123',
    });

    const result = RULE_TENANT_ISOLATION.check(context);
    expect(result.passed).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { enforceRules } from '@/lib/rules';

describe('Full Enforcement', () => {
  it('should block dangerous actions in production', async () => {
    const result = await enforceRules({
      agentType: 'coordinator',
      action: 'execute',
      payload: { command: 'rm -rf /' },
      environment: 'production',
    });

    expect(result.allowed).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ ruleId: 'GR-001' })
    );
  });
});
```

---

## Best Practices

### 1. Fail Safe

```typescript
// Always handle enforcement errors
try {
  const result = await enforceRules(context);
  if (!result.allowed) {
    return handleViolation(result);
  }
} catch (error) {
  // Enforcement system error - deny in production
  if (environment === 'production') {
    return denyAction();
  }
}
```

### 2. Use Audit Mode for Migration

```typescript
// Enable audit mode when deploying new rules
const enforcer = getRulesEnforcer({
  auditMode: true,  // Log violations without blocking
});

// Monitor logs for unexpected violations
// Then switch to enforcement mode
```

### 3. Provide User Feedback

```typescript
const result = await enforceRules(context);

if (!result.allowed) {
  // Show user-friendly messages
  for (const message of result.userMessages) {
    showNotification(message);
  }

  // Offer fallback actions
  for (const action of result.fallbackActions) {
    offerAlternative(action);
  }
}
```

### 4. Log All Violations

```typescript
// All violations are automatically logged
// Add custom monitoring for critical violations
enforcer.onViolation((violation) => {
  if (violation.severity === 'critical') {
    alertSecurityTeam(violation);
  }
});
```

---

## File Structure

```
src/lib/rules/
├── index.ts              # Main exports
├── GlobalRules.ts        # Platform constitution rules
├── LocalRules.ts         # Agent job description rules
├── RulesEnforcer.ts      # Enforcement engine
└── rules.config.yaml     # Declarative configuration
```

---

## Related Documentation

- [Security Overview](./security/SECURITY.md)
- [RBAC Guide](./security/rbac-guide.md)
- [Audit Logging](./security/audit-logging.md)
- [Circuit Breaker](./security/circuit-breaker.md)
- [Tenant Architecture](./multi-tenant-architecture.md)

---

## Changelog

### v1.0.0 (2024-01-01)
- Initial release with 11 global rules and 12 local rules
- Support for development, staging, and production environments
- Tenant override capability
- Audit mode for migration support
