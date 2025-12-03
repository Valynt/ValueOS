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
      .from('models')
      .select('*')
      .eq('id', modelId)
      .eq('organization_id', this.orgId)
      .single();
  }
}

// src/repositories/KpiRepository.ts
export class KpiRepository {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async findByModelId(modelId: string) {
    return supabase
      .from('kpis')
      .select('*')
      .eq('model_id', modelId)
      .eq('organization_id', this.orgId);
  }
}

// src/services/ModelService.ts
import { ModelRepository } from '../repositories/ModelRepository';
import { KpiRepository } from '../repositories/KpiRepository';

export class ModelService {
  private modelRepo: ModelRepository;
  private kpiRepo: KpiRepository;

  constructor(orgId: string) {
    this.modelRepo = new ModelRepository(orgId);
    this.kpiRepo = new KpiRepository(orgId);
  }

  async getModelWithKpis(modelId: string) {
    const modelResult = await this.modelRepo.findById(modelId);
    if (modelResult.error) throw modelResult.error;
    
    const kpisResult = await this.kpiRepo.findByModelId(modelId);
    if (kpisResult.error) throw kpisResult.error;

    return { ...modelResult.data, kpis: kpisResult.data };
  }
}
```

### 3. Centralized Validation with Zod

**Current Issue:** Input validation is ad-hoc, manual, and scattered. This is error-prone and insecure.

**Solution:** Use `Zod` (already in `package.json`) to define schemas for all inputs (API requests, function arguments) and validate them at the entry point of the business logic.

#### Example

```typescript
// src/validators/modelValidators.ts
import { z } from 'zod';

export const CreateModelSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
  description: z.string().optional(),
  model_data: z.record(z.any()).refine(data => Object.keys(data).length > 0, {
    message: "Model data cannot be empty",
  }),
});

// In an API route or service function
import { CreateModelSchema } from '../validators/modelValidators';

async function createModel(req, res) {
  try {
    // Validate request body at the boundary
    const validatedData = CreateModelSchema.parse(req.body);
    
    // ... proceed with service logic using validatedData
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    // ... other error handling
  }
}
```

### 4. Centralized, Environment-Aware Configuration

**Current Issue:** Configuration is loaded from `import.meta.env` or `process.env` in multiple places.

**Solution:** Create a single, typed configuration object that is loaded once and used throughout the application.

```typescript
// src/config/settings.ts
import { z } from 'zod';

const SettingsSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_KEY: z.string().optional(), // Server-side only
  REDIS_URL: z.string().url().optional(),
  // Add other config variables here
});

// Use import.meta.env for client-side, process.env for server-side
const envSource = typeof window !== 'undefined' ? import.meta.env : process.env;

export const settings = SettingsSchema.parse(envSource);

// Usage:
// import { settings } from '../config/settings';
// const supabaseUrl = settings.VITE_SUPABASE_URL;
```

---

## Medium Priority

### 5. Implement Structured Logging

**Current Issue:** Heavy reliance on `console.log`, which lacks structure and context.

**Solution:** Integrate a structured logger like `Pino` or `Winston`. Create a logger instance that can be passed through context or imported, and ensure all logs include tenant and user context.

### 6. Implement Health Check Endpoint

**Current Issue:** No centralized way to check the health of the application and its dependencies (Supabase, Redis, external LLMs).

**Solution:** Create a `/health` endpoint that performs shallow checks on all critical downstream services and returns a status. This is crucial for load balancers and automated recovery systems. `src/api/health.ts` seems to be a good starting point.

### 7. Add Graceful Shutdown Handling

**Current Issue:** The application may terminate abruptly, leaving connections open or tasks unfinished.

**Solution:** In the backend server (`src/backend/server.ts`), add handlers for `SIGTERM` and `SIGINT` to gracefully close database connections, Redis clients, and finish any in-flight requests.
