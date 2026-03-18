---
name: tool-registration
description: |
  Use when the user asks to add a new tool, register a tool, wire a tool into
  the agent system, or expose a new capability to agents. Handles requests like
  "add a CRM lookup tool", "register a new pricing tool", "create a tool that
  fetches contract data", "add a web search tool", or "expose a new API as a
  tool". Covers tool class creation, static registration on the singleton
  toolRegistry, JSON Schema parameter definition, and validation.
---

# Tool Registration

Tools are MCP-compatible capabilities exposed to agents via the singleton
`toolRegistry` in `packages/backend/src/services/ToolRegistry.ts`.

**Dynamic tool creation is forbidden.** All tools must be registered statically
at startup — never inside request handlers or agent `execute()` methods.

## Workflow

### Step 1: Create the tool file

Location: `packages/backend/src/services/tools/<ToolName>Tool.ts`

Follow the template in [references/tool-template.ts](references/tool-template.ts).

Rules:
- Extend `BaseTool` from `ToolRegistry.ts`
- `name` must be a unique kebab-case string (e.g. `"crm-lookup"`)
- `description` must be a clear, agent-readable sentence — agents use this to decide when to call the tool
- `parameters` must be a valid JSON Schema object with `type: "object"`
- `execute()` must return `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`
- Named export only — no `export default`
- No `any` in public method signatures — use Zod or typed interfaces for params

### Step 2: Register on the singleton

File: `packages/backend/src/services/ToolRegistry.ts` (bottom of file, before the singleton export) **or** in a dedicated startup registration file that imports `toolRegistry`.

```typescript
import { MyTool } from "./tools/MyTool.js";

toolRegistry.register(new MyTool());
```

Registration must happen at module load time, not inside a request handler.

### Step 3: Add metadata

Set `metadata` on the tool class for observability:

```typescript
metadata = {
  version: "1.0.0",
  category: "integration",   // e.g. "integration" | "data" | "compute" | "ui"
  tags: ["crm", "lookup"],
};
```

### Step 4: Write a test

Location: `packages/backend/src/services/tools/__tests__/<ToolName>Tool.test.ts`

- Mock any external HTTP/SDK calls with `vi.mock`
- Test: `execute()` returns `{ success: true }` on happy path
- Test: `execute()` returns `{ success: false, error: { code, message } }` on failure
- Test: `validate()` rejects missing required params

### Step 5: Verify

```bash
pnpm run lint
pnpm test -- packages/backend/src/services/tools/__tests__/<ToolName>Tool.test.ts
```

## Do not proceed if

- A tool with the same `name` string already exists in `toolRegistry` — `register()` will warn and overwrite silently
- The tool is being registered inside an agent's `execute()` method — move it to startup
- `execute()` returns raw `unknown` without a `success` boolean — callers cannot distinguish success from failure

## Completion report

```
Tool file:       packages/backend/src/services/tools/<ToolName>Tool.ts
Registered in:   packages/backend/src/services/ToolRegistry.ts (or startup file)
Test file:       packages/backend/src/services/tools/__tests__/<ToolName>Tool.test.ts
Commands run:    pnpm run lint  →  no errors
                 pnpm test -- ...<ToolName>Tool.test.ts  →  X passed
Unresolved:      [any open items]
```

## Anti-patterns

| Pattern | Fix |
|---|---|
| `toolRegistry.register(new MyTool())` inside a request handler | Move to module load time |
| `name: "MyTool"` (PascalCase) | Use kebab-case: `"my-tool"` |
| `parameters: {}` with no schema | Define `type: "object"`, `properties`, and `required` |
| `execute()` returns `any` | Return `Promise<ToolResult>` with `success` boolean |
| No `error.code` on failure | Always include `code` and `message` in error shape |
