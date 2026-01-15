# ValyntApp Dependency Policy

## Principle
ValyntApp is an **independent deployable** that consumes shared contracts, not implementations.

## Allowed Dependencies

### ✅ MAY Depend On

| Package | What to Import | Why |
|---------|----------------|-----|
| `@valueos/shared` | Types, Zod schemas, pure utils | Contracts, validation |
| `@valueos/sdui-types` | Schema contracts | SDUI type safety |
| `@valueos/components` | UI primitives | Design system |

### ❌ MUST NOT Depend On

| Package | Why |
|---------|-----|
| `@valueos/backend` | Server runtime, DB, secrets |
| `@valueos/mcp` | Server-side MCP protocol |
| Any Node-only code | Breaks browser build |

## Import Rules

```typescript
// ✅ ALLOWED - Types and contracts
import type { Permission, UserRole } from '@valueos/shared/types';
import { loginSchema } from '@valueos/shared/schemas';

// ✅ ALLOWED - Pure isomorphic utils
import { formatCurrency } from '@valueos/shared/utils';

// ❌ FORBIDDEN - Node-only
import { logger } from '@valueos/shared'; // winston = Node
import { redisClient } from '@valueos/shared'; // ioredis = Node
import { createServer } from '@valueos/backend';
```

## Communication with Backend

ValyntApp talks to `@valueos/backend` via **HTTP only**:

```typescript
// ✅ Correct - HTTP API
const response = await fetch('/api/users');

// ❌ Wrong - Direct import
import { userService } from '@valueos/backend/services';
```

## Current State

### @valueos/shared Isomorphic Status

| Export | Web-Safe | Notes |
|--------|----------|-------|
| `types/*` | ✅ | Pure TypeScript |
| `permissions` | ✅ | Pure logic |
| `piiFilter` | ✅ | Pure logic |
| `context` | ⚠️ | Check impl |
| `env` | ⚠️ | May use process.env |
| `supabase` | ✅ | Browser SDK |
| `logger` | ❌ | Uses winston (Node) |
| `redisClient` | ❌ | Uses ioredis (Node) |

### Recommendation

Split `@valueos/shared` into:
- `@valueos/shared` - Isomorphic (types, schemas, pure utils)
- `@valueos/shared-node` - Node-only (logger, redis, etc.)

Until split, ValyntApp should:
1. Import types only: `import type { X } from '@valueos/shared'`
2. Use local implementations for runtime code
3. Never import Node-only modules

## Enforcement

Add to `eslint.config.js`:

```javascript
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@valueos/backend',
        '@valueos/backend/*',
        '@valueos/shared/lib/logger',
        '@valueos/shared/lib/redisClient',
      ]
    }]
  }
}
```

## Summary

| Category | Source |
|----------|--------|
| Types & Schemas | `@valueos/shared` (types only) |
| UI Components | `@valueos/components` or local |
| API Calls | HTTP to `@valueos/backend` |
| Runtime Utils | Local in `src/lib/` |
| Validation | Zod schemas from shared or local |
