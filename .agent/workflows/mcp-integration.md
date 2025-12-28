---
description: Integrate and operationalize MCP servers
---

# MCP Server Integration Workflow

## Planning Phase (Use Planning Mode)

1. Define the MCP server's purpose:
   - What resources will it expose?
   - What tools will it provide?
   - What prompts will it offer?

2. Identify integration points in ValueOS:
   - Which services will consume MCP resources?
   - How will it integrate with existing agents?

## Implementation

3. Create the MCP server structure:

```
services/mcp-<name>/
├── index.ts          # Server entry point
├── resources/        # Resource handlers
├── tools/            # Tool implementations
├── prompts/          # Prompt templates
└── __tests__/        # Tests
```

4. Implement the server using MCP SDK:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";
```

5. Add to package.json scripts:

```json
"mcp:<name>": "tsx services/mcp-<name>/index.ts"
```

## Testing

// turbo 6. Start the MCP server locally:

```bash
npm run mcp:<name>
```

7. Test with MCP inspector (if available):

```bash
npx @modelcontextprotocol/inspector services/mcp-<name>/index.ts
```

8. Run unit tests:

```bash
npx vitest run services/mcp-<name>/
```

## Integration

9. Register with Antigravity (if applicable):
   - Add to mcp_servers configuration
   - Test resource/tool access

10. Add monitoring:

- Instrument with OpenTelemetry
- Add health check endpoint

## Documentation

11. Document the MCP server:

- Available resources
- Available tools
- Configuration options
- Usage examples
