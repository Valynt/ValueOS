# ValueOS API & Database Documentation Overview

## Executive Summary

This document provides comprehensive technical documentation for ValueOS APIs and database architecture, covering external integrations, internal services, data models, event-driven patterns, and integration best practices. ValueOS implements a robust, scalable API-first architecture with event-driven capabilities and comprehensive data management.

## API Architecture

### External API Endpoints

#### Authentication & Security

```typescript
// Bearer token authentication
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

// Token scopes
type APIScope =
  | "lifecycle:trigger" // Run agents and orchestrations
  | "docs:read" // Access documentation
  | "telemetry:write"; // Push realization data
```

#### Base URLs

- **Production**: `https://api.valuecanvas.com/v1`
- **Sandbox**: `https://sandbox-api.valuecanvas.com/v1`

#### Core Endpoints

**Lifecycle Orchestration**

```typescript
// POST /lifecycle/runs - Trigger workflow
const response = await fetch('/v1/lifecycle/runs', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    stage: 'opportunity|target|realization|expansion',
    accountId: 'uuid',
    inputs: {
      discoveryNotes: '...',
      persona: 'CFO',
      benchmarks: [...]
    }
  })
});

// Response includes runId and status URL
interface LifecycleResponse {
  runId: string;
  statusUrl: string;
  estimatedDuration: number;
}
```

**Documentation Access**

```typescript
// GET /docs/pages/{slug} - Fetch documentation
const doc = await fetch(`/v1/docs/pages/${slug}?version=latest`);
interface DocResponse {
  title: string;
  content: string;
  metadata: {
    version: string;
    lastUpdated: string;
    relatedPages: string[];
  };
}
```

**Telemetry Ingestion**

```typescript
// POST /telemetry/events - Submit metrics
await fetch("/v1/telemetry/events", {
  method: "POST",
  headers,
  body: JSON.stringify({
    accountId: "uuid",
    kpi: "response_time_ms",
    value: 123,
    timestamp: "2025-01-14T10:00:00Z",
    metadata: { source: "app" },
  }),
});
```

### Error Handling & Webhooks

**Standardized Error Format**

```typescript
interface APIError {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "AUTHENTICATION_ERROR"
      | "RATE_LIMIT_EXCEEDED"
      | "SERVER_ERROR";
    message: string;
    traceId: string;
  };
}

// Rate limiting
interface RateLimitResponse extends APIError {
  "Retry-After": string;
}
```

**Webhook Integration**

```typescript
// Configure webhook endpoints for async operations
interface WebhookConfig {
  url: string;
  events: ("run.started" | "run.completed" | "run.failed")[];
  secret: string; // HMAC verification
}

// Webhook payload
interface WebhookEvent {
  eventType: string;
  runId: string;
  status: "started" | "completed" | "failed";
  data: any;
  signature: string; // HMAC-SHA256
}
```

## Internal Service Architecture

### Base Service Infrastructure

#### Core Service Classes

```typescript
abstract class BaseService {
  // Retry logic with exponential backoff
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = { maxRetries: 3 }
  ): Promise<T> {
    // Implementation with exponential backoff
  }

  // Request deduplication (1-second window)
  protected async deduplicateRequest<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Implementation
  }

  // Automatic caching (5-minute TTL)
  protected async cachedRequest<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    // Implementation
  }
}
```

#### Error Hierarchy

```typescript
enum ErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TIMEOUT = "TIMEOUT",
  SERVER_ERROR = "SERVER_ERROR",
}

class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode?: number
  ) {
    super(message);
  }
}
```

### Core Services

#### SettingsService - Configuration Management

```typescript
interface SettingsConfig {
  key: string;
  value: any;
  type: "string" | "number" | "boolean" | "object" | "array";
  scope: "user" | "team" | "organization";
  scopeId: string;
}

class SettingsService extends BaseService {
  async getSetting(key: string, scope: string, scopeId: string): Promise<any>;
  async createSetting(config: SettingsConfig): Promise<Setting>;
  async updateSetting(
    key: string,
    scope: string,
    scopeId: string,
    value: any
  ): Promise<void>;
  async bulkUpdateSettings(
    scope: string,
    scopeId: string,
    updates: Record<string, any>
  ): Promise<void>;
}
```

#### AuthService - Authentication & Sessions

```typescript
interface AuthCredentials {
  email: string;
  password: string;
  fullName?: string;
}

class AuthService extends BaseService {
  async signup(
    credentials: AuthCredentials
  ): Promise<{ user: User; session: Session }>;
  async login(
    credentials: Omit<AuthCredentials, "fullName">
  ): Promise<{ user: User; session: Session }>;
  async logout(): Promise<void>;
  async refreshSession(): Promise<{ user: User; session: Session }>;
  async getCurrentUser(): Promise<User | null>;
  async isAuthenticated(): Promise<boolean>;
}
```

#### PermissionService - RBAC Implementation

```typescript
type Permission =
  | "user.view"
  | "user.edit"
  | "team.view"
  | "team.manage"
  | "team.members.manage"
  | "organization.manage"
  | "billing.view"
  | "billing.manage"
  | "security.manage"
  | "audit.view";

class PermissionService extends BaseService {
  async hasPermission(
    userId: string,
    permission: Permission,
    scope: string,
    scopeId: string
  ): Promise<boolean>;
  async hasAllPermissions(
    userId: string,
    permissions: Permission[],
    scope: string,
    scopeId: string
  ): Promise<boolean>;
  async requirePermission(
    userId: string,
    permission: Permission,
    scope: string,
    scopeId: string
  ): Promise<void>;
  async getUserRoles(
    userId: string,
    scope: string,
    scopeId: string
  ): Promise<string[]>;
}
```

#### AuditLogService - Comprehensive Logging

```typescript
interface AuditEvent {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: "success" | "failure";
}

class AuditLogService extends BaseService {
  async log(event: AuditEvent): Promise<string>;
  async query(params: AuditQuery): Promise<AuditEvent[]>;
  async getById(id: string): Promise<AuditEvent>;
  async export(format: "csv" | "json", query: AuditQuery): Promise<string>;
  async getStatistics(startDate: string, endDate: string): Promise<AuditStats>;
  async deleteOldLogs(cutoffDate: string): Promise<number>;
}
```

## Database Architecture

### Schema Overview

#### Core Tables

```sql
-- User management
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-tenant organization
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business cases
CREATE TABLE value_cases (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent executions
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY,
  agent_name TEXT NOT NULL,
  input JSONB,
  output JSONB,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  token_usage JSONB,
  confidence_score DECIMAL
);
```

#### Row-Level Security (RLS)

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE value_cases ENABLE ROW LEVEL SECURITY;

-- Policy for organization-scoped access
CREATE POLICY tenant_isolation ON value_cases
FOR ALL USING (organization_id = current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id');
```

### Advanced Database Features

#### Custom Domains Schema

```sql
CREATE TABLE custom_domains (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  domain TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  ssl_certificate TEXT,
  verification_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain validation
CREATE OR REPLACE FUNCTION validate_domain_format(domain TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN domain ~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
END;
$$ LANGUAGE plpgsql;
```

#### Encryption Implementation

```sql
-- Encrypted settings storage
CREATE TABLE encrypted_settings (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encryption functions
CREATE OR REPLACE FUNCTION encrypt_value(value TEXT, key_id TEXT)
RETURNS TEXT AS $$
  -- Implementation using pgcrypto
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_value(encrypted_value TEXT, key_id TEXT)
RETURNS TEXT AS $$
  -- Implementation using pgcrypto
$$ LANGUAGE plpgsql;
```

#### Vector Queries for AI

```sql
-- Vector embeddings storage
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  embedding VECTOR(1536), -- OpenAI ada-002 dimensions
  content_type TEXT,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search
CREATE OR REPLACE FUNCTION find_similar_documents(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE(document_id UUID, similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.document_id,
    1 - (de.embedding <=> query_embedding) as similarity
  FROM document_embeddings de
  WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

### Enterprise SaaS Configuration

```sql
-- Multi-tenant configuration
CREATE TABLE tenant_configs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  config_key TEXT NOT NULL,
  config_value JSONB,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, config_key)
);

-- JWT RLS implementation
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_id UUID;
BEGIN
  -- Extract from JWT claims
  tenant_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::UUID;
  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Foreign key actions
CREATE TABLE parent_child_relationships (
  parent_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  child_id UUID REFERENCES entities(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Event-Driven Architecture

### Kafka Integration

#### Message Broker Configuration

```yaml
# docker-compose.kafka.yml
version: "3.8"
services:
  kafka:
    image: confluentinc/cp-kafka:7.3.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:29092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.3.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
```

#### Event Schema Design

```typescript
interface AgentRequestEvent {
  eventId: string;
  correlationId: string;
  agentId: string;
  userId: string;
  sessionId: string;
  query: string;
  context?: any;
  parameters?: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AgentResponseEvent {
  eventId: string;
  correlationId: string;
  agentId: string;
  response: any;
  error?: string;
  latency: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp: Date;
}

interface WorkflowStepEvent {
  eventId: string;
  workflowId: string;
  stepId: string;
  stepType: "agent_call" | "data_processing" | "decision" | "end";
  status: "started" | "completed" | "failed";
  input: any;
  output?: any;
  error?: string;
  timestamp: Date;
}
```

### Saga Pattern Implementation

#### Saga Orchestration

```typescript
enum SagaState {
  STARTED = "STARTED",
  AGENT_CALL_PENDING = "AGENT_CALL_PENDING",
  AGENT_RESPONSE_RECEIVED = "AGENT_RESPONSE_RECEIVED",
  PROCESSING = "PROCESSING",
  COMPENSATING = "COMPENSATING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

interface SagaCommand {
  sagaId: string;
  command: "start_saga" | "compensate" | "complete_saga";
  sagaType: string;
  payload: any;
  timestamp: Date;
}
```

#### Compensation Logic

```typescript
class SagaOrchestrator {
  async executeSaga(sagaType: string, payload: any): Promise<SagaResult> {
    const sagaId = uuidv4();

    try {
      // Start saga
      await this.publishCommand({
        sagaId,
        command: "start_saga",
        sagaType,
        payload,
      });

      // Execute steps with compensation
      for (const step of this.getSagaSteps(sagaType)) {
        await this.executeStepWithCompensation(sagaId, step, payload);
      }

      // Complete saga
      await this.publishCommand({
        sagaId,
        command: "complete_saga",
        sagaType,
        payload: { success: true },
      });

      return { success: true, sagaId };
    } catch (error) {
      // Initiate compensation
      await this.compensateSaga(sagaId, sagaType, payload);
      return { success: false, sagaId, error: error.message };
    }
  }
}
```

### Service Decomposition

#### Agent Orchestrator Service

```typescript
class AgentOrchestratorService {
  constructor(
    private kafkaClient: KafkaClient,
    private agentRegistry: AgentRegistry
  ) {}

  async handleAgentRequest(request: AgentRequestEvent): Promise<void> {
    // Route to appropriate agent
    const agent = this.agentRegistry.getAgent(request.agentId);

    try {
      const result = await agent.execute(request);

      // Publish response event
      await this.kafkaClient.publish("agent-responses", {
        eventId: uuidv4(),
        correlationId: request.correlationId,
        agentId: request.agentId,
        response: result,
        latency: Date.now() - request.timestamp.getTime(),
        timestamp: new Date(),
      });
    } catch (error) {
      // Publish error event
      await this.kafkaClient.publish("agent-responses", {
        eventId: uuidv4(),
        correlationId: request.correlationId,
        agentId: request.agentId,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }
}
```

#### Agent Executor Service

```typescript
class AgentExecutorService {
  constructor(private kafkaClient: KafkaClient) {}

  async start(): Promise<void> {
    // Subscribe to agent requests
    await this.kafkaClient.subscribe(
      "agent-requests",
      async (event: AgentRequestEvent) => {
        await this.executeAgentRequest(event);
      }
    );
  }

  private async executeAgentRequest(event: AgentRequestEvent): Promise<void> {
    // Execute agent logic
    const agent = this.getAgentInstance(event.agentId);
    const result = await agent.process(event.query, event.context);

    // Publish result
    await this.publishAgentResponse(event, result);
  }
}
```

## Backend Dependencies & Integration

### Frontend-Backend Integration Points

#### Tenant Context Management

```typescript
// Required API endpoint for tenant switching
interface TenantAPI {
  // GET /api/users/:userId/tenants
  getUserTenants(userId: string): Promise<Tenant[]>;

  // Current fallback: Direct Supabase query
  getTenantsViaSupabase(): Promise<Tenant[]>;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  color: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "inactive" | "pending";
  createdAt: string;
}
```

#### Feature Flags & Configuration

```typescript
// Environment-based feature toggles
interface FeatureFlags {
  TENANTS_API_ENABLED: boolean; // Default: true
  AGENTS_ENABLED: boolean; // Default: true
  WORKFLOW_ENABLED: boolean; // Default: true
  TELEMETRY_ENABLED: boolean; // Default: true
}

// Component-level feature detection
const useFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  const config = useConfig();
  return config.features[flag] ?? true;
};
```

### WebSocket Integration (Future)

```typescript
// Agent state streaming
interface WebSocketChannels {
  agentState: `agent:${sessionId}`;
  workflowUpdates: `workflow:${workflowId}`;
  realTimeMetrics: `metrics:${caseId}`;
}

// Connection management
class WebSocketManager {
  connect(channel: string): Promise<WebSocketConnection>;
  subscribe(event: string, handler: (data: any) => void): void;
  publish(event: string, data: any): void;
  disconnect(): void;
}
```

## API Examples & Use Cases

### Agent System Integration

#### Simple Agent Task Execution

```typescript
import { CoordinatorAgent } from "./agents/CoordinatorAgent";

const coordinator = new CoordinatorAgent();

// Plan and execute a value discovery task
const plan = await coordinator.planTask({
  intent_type: "value_discovery",
  intent_description: "Identify cost reduction opportunities in supply chain",
  business_case_id: "case-123",
  user_id: "user-456",
});

console.log("Execution Plan:", plan);
// Output: { task_id, subgoals: [...], routing: [...] }
```

#### Agent Communication Patterns

```typescript
import { CommunicatorAgent } from "./agents/CommunicatorAgent";

const comm = new CommunicatorAgent("MyAgent");

// Send message to another agent
await comm.sendMessage(
  "SystemMapperAgent",
  "task_assignment",
  {
    task_id: "task-789",
    system_id: "system-123",
    analysis_type: "feedback_loops",
  },
  { priority: "high" }
);

// Request-response pattern
const response = await comm.request(
  "SystemMapperAgent",
  { action: "analyze_system", system_id: "system-123" },
  5000 // timeout
);
```

### SDUI Generation Examples

#### Dynamic Dashboard Creation

```typescript
import { CoordinatorAgent } from "./agents/CoordinatorAgent";

const coordinator = new CoordinatorAgent();

// Generate interactive dashboard
const layout = await coordinator.produceSDUILayout({
  id: "dashboard-subgoal",
  subgoal_type: "dashboard_creation",
  subgoal_description: "Create executive dashboard with KPIs",
  output: {
    kpis: [
      { name: "Revenue", value: 1000000, trend: "up" },
      { name: "Costs", value: 750000, trend: "down" },
    ],
  },
  estimated_complexity: 5,
  status: "in_progress",
});

const Dashboard = renderPage(layout);
```

#### Component Tool Selection

```typescript
import { searchComponentTools } from "./sdui/ComponentToolRegistry";

// Find appropriate components for a use case
const components = searchComponentTools(
  "Show financial metrics with trends",
  5 // max results
);

console.log("Suggested Components:", components);
// Output: [{ name: 'MetricCard', score: 0.95 }, ...]
```

### Database Operations

#### Real-time Subscriptions

```typescript
import { supabase } from "./lib/supabase";

// Subscribe to agent execution updates
const subscription = supabase
  .channel("agent-executions")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "agent_executions",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      console.log("New execution:", payload.new);
    }
  )
  .subscribe();
```

#### Secure Multi-tenant Queries

```typescript
// RLS-protected queries automatically scope to tenant
const { data, error } = await supabase
  .from("value_cases")
  .select("*")
  .eq("status", "active")
  .order("created_at", { ascending: false });

// RLS policy ensures only tenant's cases are returned
```

### Workflow Orchestration

#### Complex Workflow Execution

```typescript
import { workflowOrchestrator } from "./services/WorkflowOrchestrator";

const execution = await workflowOrchestrator.executeWorkflow(
  "value-discovery-workflow",
  {
    case_id: "case-123",
    user_id: "user-456",
    parameters: {
      industry: "manufacturing",
      focus_area: "supply_chain",
    },
  }
);

console.log("Workflow started:", execution.id);
```

#### Workflow Monitoring

```typescript
const status = await workflowOrchestrator.getExecutionStatus("execution-123");

console.log("Status:", status.status);
console.log("Progress:", `${status.completed_steps}/${status.total_steps}`);
console.log("Current Step:", status.current_step);
```

## Performance Optimization

### Service-Level Optimizations

#### Request Deduplication

```typescript
// Multiple rapid calls are automatically deduplicated
const [result1, result2, result3] = await Promise.all([
  settingsService.getSetting("theme", "user", userId),
  settingsService.getSetting("theme", "user", userId),
  settingsService.getSetting("theme", "user", userId),
]);
// Only 1 database call is made
```

#### Intelligent Caching

```typescript
// Automatic caching with TTL
const settings = await settingsService.getSettings({
  scope: "user",
  scopeId: userId,
}); // Cached for 5 minutes

// Skip cache for fresh data
const freshData = await service.executeRequest(operation, {
  skipCache: true,
});
```

#### Bulk Operations

```typescript
// Single query instead of multiple
await settingsService.bulkUpdateSettings("user", userId, {
  theme: "dark",
  language: "en",
  compactMode: true,
});
```

### Database Performance

#### Query Optimization

```sql
-- Efficient indexed queries
SELECT * FROM value_cases
WHERE organization_id = $1
  AND status = 'active'
  AND created_at > $2
ORDER BY created_at DESC
LIMIT 50;

-- Composite index: (organization_id, status, created_at)
CREATE INDEX idx_value_cases_org_status_created
ON value_cases(organization_id, status, created_at DESC);
```

#### Connection Pooling

```typescript
// Supabase handles connection pooling automatically
const { data } = await supabase
  .from("agent_executions")
  .select("*")
  .eq("user_id", userId)
  .order("started_at", { ascending: false })
  .limit(10);
// Connections are automatically pooled and reused
```

## Error Handling & Resilience

### Comprehensive Error Hierarchy

```typescript
import { ServiceError, ValidationError, NetworkError } from "./services/errors";

try {
  await settingsService.updateSetting(key, scope, scopeId, { value });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors (400)
    showValidationMessage(error.message);
  } else if (error instanceof NetworkError) {
    // Handle network issues with retry
    await retryOperation(operation);
  } else if (error instanceof ServiceError) {
    // Handle service-level errors
    logServiceError(error.code, error.message);
  } else {
    // Handle unexpected errors
    logUnexpectedError(error);
  }
}
```

### Retry Strategies

```typescript
// Automatic exponential backoff
await service.executeRequest(operation, {
  retries: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
});

// Custom retry logic
const result = await retryAsync(
  () => externalAPI.call(),
  3, // max retries
  (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000) // exponential backoff
);
```

## Testing Strategy

### Service Testing

```typescript
import { describe, it, expect } from "vitest";
import { SettingsService } from "./services/SettingsService";

describe("SettingsService", () => {
  it("should create and retrieve setting", async () => {
    const service = new SettingsService(mockSupabase);

    const setting = await service.createSetting({
      key: "test",
      value: "value",
      type: "string",
      scope: "user",
      scopeId: "test-user",
    });

    const retrieved = await service.getSetting("test", "user", "test-user");
    expect(retrieved).toBe("value");
  });

  it("should handle validation errors", async () => {
    const service = new SettingsService(mockSupabase);

    await expect(
      service.createSetting({
        key: "test",
        value: 123,
        type: "string", // Type mismatch
        scope: "user",
        scopeId: "test-user",
      })
    ).rejects.toThrow(ValidationError);
  });
});
```

### API Testing

```typescript
describe("API Endpoints", () => {
  it("should create value case", async () => {
    const response = await request(app)
      .post("/api/value-cases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test Case",
        organizationId: "org-123",
      })
      .expect(201);

    expect(response.body).toHaveProperty("id");
    expect(response.body.title).toBe("Test Case");
  });
});
```

## Versioning & Compatibility

### API Versioning Strategy

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Backward compatibility within major versions
- Deprecation notices for breaking changes
- Migration guides for version upgrades

### Database Schema Evolution

```sql
-- Safe schema changes with zero downtime
-- Add new column with default
ALTER TABLE value_cases ADD COLUMN priority TEXT DEFAULT 'medium';

-- Create index concurrently (non-blocking)
CREATE INDEX CONCURRENTLY idx_value_cases_priority ON value_cases(priority);

-- Rename column safely
ALTER TABLE value_cases ADD COLUMN urgency TEXT;
UPDATE value_cases SET urgency = priority WHERE urgency IS NULL;
ALTER TABLE value_cases DROP COLUMN priority;
```

---

**Last Updated**: January 14, 2026
**Version**: 1.0
**Maintained By**: Engineering Team
**Review Frequency**: Monthly
