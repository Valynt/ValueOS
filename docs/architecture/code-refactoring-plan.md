# Code Refactoring Plan

This document outlines high-priority refactoring tasks to improve the codebase's quality, maintainability, and security before production deployment.

---

## High Priority

### 1. Refactor Agent Context & State Management

**Current Issue:** Agents instantiated within the `ValueLifecycleOrchestrator` do not receive the `organizationId`. They are not tenant-aware and rely on the orchestrator to perform tenant-safe operations.

**Solution:** Refactor the `BaseAgent` and all derived agents to accept and use a `LifecycleContext` containing the `organizationId`. This makes agents explicitly tenant-aware and improves security.

#### Before

```typescript
// src/services/ValueLifecycleOrchestrator.ts
private getAgentForStage(stage: LifecycleStage): BaseAgent {
    const agents: Record<LifecycleStage, BaseAgent> = {
      opportunity: new OpportunityAgent(this.supabase),
      // ...
    };
    return agents[stage];
  }
```

#### After

```typescript
// src/lib/agent-fabric/agents/BaseAgent.ts
export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected context: LifecycleContext;

  constructor(supabase: SupabaseClient, context: LifecycleContext) {
    this.supabase = supabase;
    this.context = context;
  }
  // Now, any internal method can access this.context.organizationId
}

// src/services/ValueLifecycleOrchestrator.ts
private getAgentForStage(stage: LifecycleStage, context: LifecycleContext): BaseAgent {
    const agents: Record<LifecycleStage, new (supabase: SupabaseClient, context: LifecycleContext) => BaseAgent> = {
      opportunity: OpportunityAgent,
      target: TargetAgent,
      // ...
    };
    const AgentClass = agents[stage];
    return new AgentClass(this.supabase, context);
  }

// In executeLifecycleStage method:
const agent = this.getAgentForStage(stage, context);
```

### 2. Implement a Service and Data Access Object (DAO) Layer

**Current Issue:** Business logic, especially Supabase queries, is often scattered across services and sometimes directly in API layers or components. This makes the code harder to test and maintain.

**Solution:** Abstract all database interactions behind a DAO/Repository layer. A Service layer will then use one or more DAOs to perform business operations.

#### Before (Simplified Example)

```typescript
// src/services/SomeService.ts
async function getModelAndRelatedKpis(modelId: string, orgId: string) {
  const { data: model, error: modelError } = await supabase
    .from('models')
    .select('*')
    .eq('id', modelId)
    .eq('organization_id', orgId)
    .single();

  const { data: kpis, error: kpiError } = await supabase
    .from('kpis')
    .select('*')
    .eq('model_id', modelId)
    .eq('organization_id', orgId);
    
  // ... logic to combine them
}
```

#### After (DAO/Service Pattern)

```typescript
// src/repositories/ModelRepository.ts
import { supabase } from '../lib/supabase';

export class ModelRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async findById(modelId: string) {
    return supabase
```
