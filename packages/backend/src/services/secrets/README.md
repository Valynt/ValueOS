# Tenant-Safe Secret Layer

> **Design brief:** `tenant_safe_secret_layer_design_brief.md`

This module implements a secure, multi-tenant secret management layer that enforces strict tenant isolation, capability-based agent access, and full auditability across all workflows and integrations.

---

## Core Principles

| Principle | Enforcement |
|---|---|
| **Tenant Isolation First** | Every DB query includes `organization_id` in the predicate; no cross-tenant fallback is possible |
| **Capability-Based Access** | Agents request capabilities (e.g. `salesforce.read`), never raw secrets |
| **Zero Secret Exposure to Models** | Decrypted values are produced only inside `SecretBrokerService.resolve()` and zeroed out after tool execution |
| **Policy-Enforced Access** | Deny-by-default; every allow-list must explicitly include the agent, tool, and purpose |
| **Full Observability** | Every allow/deny decision is written to `secret_access_audits` as an immutable row |

---

## Module Structure

```
services/secrets/
├── TenantSecretTypes.ts         — All type definitions and interfaces
├── TenantSecretRepository.ts    — Database I/O (tenant_secrets + secret_access_audits)
├── SecretBrokerService.ts       — Central enforcement layer (resolve, upsert, rotate)
├── CapabilityResolver.ts        — Agent-facing capability request API
├── SecretAwareToolExecutor.ts   — Tool integration layer with automatic credential injection
├── index.ts                     — Public API exports
└── __tests__/
    ├── SecretBrokerService.test.ts
    └── SecretAwareToolExecutor.test.ts
```

---

## Access Flow

```
Agent (workflow context)
  │
  │  requests capability "salesforce.read"
  ▼
CapabilityResolver.requestCapability()
  │
  │  builds SecretAccessRequest
  ▼
SecretBrokerService.resolve()
  ├── 1. Validate tenantId present
  ├── 2. Look up TenantSecretRecord (scoped by org_id + integration + env)
  ├── 3. Enforce policy (agent, tool, purpose, environment allow-lists)
  ├── 4. Decrypt encrypted_value  ← ONLY HERE
  ├── 5. Build ephemeral SecretAccessGrant (TTL: 5 min)
  ├── 6. Append audit record (allow/deny)
  └── 7. Return grant or structured deny
```

---

## Usage

### Storing a Secret (Admin / Provisioning)

```typescript
import { getSecretBrokerService } from './services/secrets';

const broker = getSecretBrokerService();

await broker.upsertSecret({
  tenantId: 'org-uuid',
  integration: 'salesforce',
  secretName: 'read',
  plaintextValue: 'my-sf-api-key',   // encrypted before persistence
  environment: 'production',
  allowedAgents: ['value-discovery-agent'],
  allowedTools: ['salesforce_query'],
  allowedPurposes: ['salesforce.read'],
  actorId: 'admin-user-id',
});
```

### Tool Executor (Capability-Based Access)

```typescript
import { getSecretAwareToolExecutor } from './services/secrets';

const executor = getSecretAwareToolExecutor();

const result = await executor.execute(
  'salesforce_query',                          // toolName
  [{ capability: 'salesforce.read', purpose: 'salesforce.read' }],
  { query: 'SELECT Id, Name FROM Opportunity' },
  {
    tenantId: ctx.tenantId,                    // injected by runtime
    agentId: ctx.agentId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    environment: 'production',
  },
  async (params, secrets) => {
    const apiKey = secrets['salesforce.read'].decryptedValue;
    // use apiKey here — do NOT log it
    return sfClient.query(params.query, apiKey);
  }
);
```

### Rotating a Secret

```typescript
await broker.rotateSecret({
  tenantId: 'org-uuid',
  integration: 'salesforce',
  secretName: 'read',
  environment: 'production',
  newPlaintextValue: 'new-rotated-key',
  actorId: 'admin-user-id',
});
// key_version is incremented; old encrypted_value is replaced; cache is invalidated
```

### Querying the Audit Log

```typescript
const audits = await broker.getAuditLog('org-uuid', {
  agentId: 'value-discovery-agent',
  decision: 'deny',
  since: '2026-01-01T00:00:00Z',
  limit: 100,
});
```

---

## Database Schema

### `tenant_secrets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation — required for all queries |
| `integration` | text | e.g. `salesforce`, `hubspot` |
| `secret_name` | text | e.g. `read`, `api_key` |
| `encrypted_value` | text | AES-256-GCM envelope-encrypted ciphertext |
| `key_version` | integer | Incremented on each rotation |
| `environment` | text | `development`, `staging`, `production` |
| `allowed_agents` | text[] | Agent IDs; empty = deny all |
| `allowed_tools` | text[] | Tool names; empty = deny all |
| `allowed_purposes` | text[] | Purpose strings; empty = deny all |
| `rotation_metadata` | jsonb | Rotation history |

### `secret_access_audits`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Tenant isolation |
| `agent_id` | text | Agent that requested the capability |
| `workflow_id` | text | Optional workflow context |
| `run_id` | text | Optional run context |
| `capability` | text | Capability requested |
| `purpose` | text | Declared purpose |
| `tool_name` | text | Tool that requested the credential |
| `decision` | text | `allow` or `deny` |
| `reason` | text | Deny reason or allow confirmation |
| `created_at` | timestamptz | Immutable — no UPDATE/DELETE |

---

## Security Controls

**Isolation:** `organization_id` is required in every query predicate; no cross-tenant fallback or inference is possible.

**Redaction:** Decrypted values are never logged, traced, or serialized. The `SecretAwareToolExecutor` zeroes out `decryptedValue` in the `SecretContext` after the handler returns.

**Cache Safety:** No caching layer is implemented by default. If caching is added, it must use tenant-scoped keys with a short TTL.

**Environment Separation:** `development`, `staging`, and `production` environments are strictly isolated via the `environment` column.

**Deny-by-Default:** An empty `allowed_agents`, `allowed_tools`, or `allowed_purposes` array results in a DENY for all requests.

---

## Failure Handling

All denied access attempts return a structured `SecretBrokerDecision` with a `SecretDenyReason` code and are written to `secret_access_audits`. The `SecretAccessDeniedError` class carries the deny reason for upstream error classification and escalation.

---

## Non-Goals

This module is not a general-purpose secrets vault for end users, not a replacement for Infisical (platform-level secrets), and is not exposed to the frontend.
