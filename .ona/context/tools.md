# Tool Inventory — ValueOS

Reference for AI agents on what tools exist, how they are structured, and how to add new ones.
"Tools" here means callable units that agents can invoke — not CLI commands.

---

## Two Tool Systems

ValueOS has two distinct tool systems. Do not confuse them.

| System | Interface | Registry | Location | Used by |
|---|---|---|---|---|
| **MCP Tools** | `MCPTool` | `ToolRegistry` (singleton) | `packages/backend/src/services/ToolRegistry.ts` | Agent fabric, LLM function calling |
| **BFA Semantic Tools** | `SemanticTool<TInput, TOutput>` | `InMemoryToolRegistry` | `packages/backend/src/services/bfa/` | Backend-for-Agents pattern |

Both registries are **static** — tools are registered at startup. Dynamic tool creation at runtime is forbidden.

---

## System 1: MCP Tools (`ToolRegistry`)

### Interface

```typescript
// packages/backend/src/services/ToolRegistry.ts
export interface MCPTool {
  name: string;                    // unique identifier
  description: string;             // LLM-readable description
  parameters: JSONSchema;          // JSON Schema for inputs
  execute(params: unknown, context?: ToolExecutionContext): Promise<ToolResult>;
  validate?(params: unknown): Promise<ValidationResult>;
  metadata?: {
    version?: string;
    category?: string;
    tags?: string[];
    rateLimit?: { maxCalls: number; windowMs: number };
  };
}
```

### Registration

```typescript
import { toolRegistry } from '../services/ToolRegistry.js';

toolRegistry.register({
  name: 'my_tool',
  description: 'What this tool does for an LLM',
  parameters: { type: 'object', properties: { ... }, required: [...] },
  async execute(params, context) {
    // implementation
    return { success: true, data: ... };
  }
});
```

Registration must happen at module load time (not inside a request handler).

---

## System 2: BFA Semantic Tools (`SemanticTool`)

Preferred for new tools. Provides Zod validation, policy enforcement, and auth guard out of the box.

### Interface

```typescript
// packages/backend/src/services/bfa/types.ts
export interface SemanticTool<TInput, TOutput> {
  id: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  policy?: { resource: string; action: string; requiredPermissions: string[] };
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
}
```

### Base class

Extend `BaseSemanticTool<TInput, TOutput>` from `packages/backend/src/services/bfa/base-tool.ts`.
It handles Zod parse/validate, policy enforcement via `PolicyEnforcement`, and structured logging.

### Registration

```typescript
// packages/backend/src/services/bfa/registry.ts
import { registerTool } from './registry.js';
import { MyTool } from './tools/my-domain/my-tool.js';

registerTool(new MyTool());
```

### Example: `ActivateCustomer`

```
packages/backend/src/services/bfa/tools/onboarding/activate-customer.ts
```

```typescript
export class ActivateCustomer extends BaseSemanticTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> {
  id = 'activate_customer';
  description = 'Activate a customer account with validation and business rules';
  inputSchema = z.object({
    customerId: z.string().uuid(),
    activationCode: z.string().min(6),
  });
  outputSchema = z.object({
    success: z.boolean(),
    activatedAt: z.date(),
    welcomeMessage: z.string(),
    customerEmail: z.string().email(),
  });
  policy = {
    resource: 'customer',
    action: 'activate',
    requiredPermissions: ['customer:activate', 'user:write'],
  };

  async execute(input, context) { ... }
}
```

---

## Registered Tools (current)

### BFA Semantic Tools

| Tool ID | Class | Location | Status |
|---|---|---|---|
| `activate_customer` | `ActivateCustomer` | `bfa/tools/onboarding/activate-customer.ts` | ✅ |

### MCP Tools

Registered at module load time (server startup). Query at runtime:

```bash
curl http://localhost:3001/api/mcp/tools
```

Or inspect `ToolRegistry` singleton in `packages/backend/src/services/ToolRegistry.ts`.

---

## Adding a New Tool

### Decision: which system?

- New domain operations (business logic, DB writes, external API calls) → **BFA SemanticTool**
- LLM function-calling tools exposed via MCP → **MCPTool**
- When in doubt, use BFA — it has better validation and policy enforcement

### BFA tool checklist

1. Create file: `packages/backend/src/services/bfa/tools/<domain>/<tool-name>.ts`
2. Define `inputSchema` and `outputSchema` as Zod objects
3. Extend `BaseSemanticTool<TInput, TOutput>`
4. Set `id` (snake_case), `description` (LLM-readable), `policy`
5. Implement `execute(input, context)` — include `organization_id` in any DB query
6. Register in `packages/backend/src/services/bfa/registry.ts` at module load
7. Add co-located test in `<domain>/__tests__/<tool-name>.test.ts`

### MCP tool checklist

1. Implement `MCPTool` interface
2. Call `toolRegistry.register(tool)` at module load — not inside a request handler
3. Provide a JSON Schema for `parameters` (used by LLM for function calling)
4. Return `ToolResult` with `success: boolean` and typed `data`

---

## Auth Guard

BFA tools go through `AuthGuard` in `packages/backend/src/services/bfa/auth-guard.ts`.
It checks `tool.policy.requiredPermissions` against the `AgentContext` before executing.
Tools without a `policy` field skip the permission check — only use this for read-only,
non-sensitive operations.

---

## Tool Execution Context

Both systems accept a context object. Always propagate `traceId` for distributed tracing:

```typescript
const context: ToolExecutionContext = {
  userId: req.user.id,
  sessionId: req.sessionId,
  agentType: 'OpportunityAgent',
  traceId: req.headers['x-trace-id'] as string,
};
```

---

## MCP Discovery Endpoint

Tools registered in `ToolRegistry` are discoverable via the MCP protocol:

```
GET  /api/mcp          — list available tools
POST /api/mcp/execute  — execute a tool by name
```

Router: `mcpDiscoveryRouter` mounted at `/api/mcp` in `server.ts`.
