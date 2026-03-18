# Database JSONB Schema Documentation

This document describes the structure of JSONB columns used in the ValueOS database.

## Table: `agent_execution_lineage`

Append-only record of every agent `secureInvoke` call. Captures memory reads, tool calls, and DB writes for complete execution lineage.

### Column: `memory_reads` (JSONB[])

Array of memory entries read during agent execution.

```typescript
interface MemoryReadEntry {
  id: string;              // UUID of memory entry
  type: 'semantic' | 'episodic' | 'procedural';
  source: string;          // Memory source identifier
  accessed_at: string;     // ISO timestamp
  relevance_score?: number; // Optional similarity score
  metadata?: {
    embedding_model?: string;
    token_count?: number;
  };
}
```

### Column: `tool_calls` (JSONB[])

Array of tool invocations made during agent execution.

```typescript
interface ToolCallEntry {
  id: string;              // UUID of tool call
  tool_name: string;       // Name of tool invoked
  input: Record<string, unknown>;  // Tool input parameters
  output?: Record<string, unknown>; // Tool output (if completed)
  started_at: string;      // ISO timestamp
  completed_at?: string;   // ISO timestamp (null if failed)
  status: 'pending' | 'success' | 'error';
  error_message?: string;  // Error details if status='error'
}
```

### Column: `db_writes` (JSONB[])

Array of database modifications made during agent execution.

```typescript
interface DBWriteEntry {
  id: string;              // UUID of write operation
  table_name: string;      // Target table
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  primary_key: Record<string, unknown>; // Record identifier
  changed_fields?: string[]; // Fields modified (UPDATE only)
  old_values?: Record<string, unknown>; // Previous values (UPDATE/DELETE)
  new_values?: Record<string, unknown>; // New values (INSERT/UPDATE)
  written_at: string;      // ISO timestamp
}
```

---

## Table: `conversation_history`

Stores conversation threads for value cases with complete tenant isolation.

### Column: `messages` (JSONB[])

Array of conversation messages.

```typescript
interface ConversationMessage {
  id: string;              // UUID of message
  role: 'user' | 'assistant' | 'system';
  content: string;         // Message text
  timestamp: string;       // ISO timestamp
  agentName?: string;      // Name of agent (assistant messages)
  confidence?: number;     // Agent confidence score (0-1)
  reasoning?: string[];    // Agent reasoning steps
  sduiPage?: {
    type: string;
    components: unknown[];
    layout: Record<string, unknown>;
  };                     // Optional SDUI page render
  metadata?: {
    tokens_in?: number;
    tokens_out?: number;
    model?: string;
    latency_ms?: number;
  };
}
```

---

## Table: `usage_events`

Tracks metered usage for billing with idempotency support.

### Column: `dimensions` (JSONB)

Flexible key-value pairs for usage categorization.

```typescript
interface UsageDimensions {
  // Common dimensions
  feature?: string;        // Feature identifier
  endpoint?: string;       // API endpoint
  model?: string;          // LLM model used
  
  // Agent-specific
  agent_name?: string;
  session_id?: string;
  
  // Request-specific
  request_type?: string;
  status?: 'success' | 'error' | 'timeout';
  
  // Custom dimensions (extensible)
  [key: string]: string | number | boolean | undefined;
}
```

---

## Migration History

| Table | Migration File | Date Applied |
|-------|---------------|--------------|
| agent_execution_lineage | 20260914000000_agent_execution_lineage.sql | 2026-03-18 |
| conversation_history | 20260913000000_conversation_history_tenant_isolation.sql | 2026-03-18 |
| usage_events (request_id unique) | 20260316211357_usage_events_request_id_unique.sql | 2026-03-18 |
| user_tenants (FK + RPC) | 20260911000000_user_tenants_fk_and_refresh_rpc.sql | 2026-03-18 |

---

## Notes

- All JSONB arrays default to `'[]'::jsonb` for consistent querying
- JSONB fields are append-only or versioned — partial updates are not supported
- Use `jsonb_array_elements()` for querying individual array elements
- Index on JSONB fields use GIN where appropriate (see `idx_*_jsonb` indexes)
