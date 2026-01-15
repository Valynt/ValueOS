# @valueos/infra

Infrastructure adapters for ValueOS.

## Structure

```
infra/
├── supabase/      # Auth, database, storage via Supabase
├── database/      # Direct database access (when needed)
├── queues/        # Message queues (Redis, etc.)
├── storage/       # File/blob storage
└── observability/ # Logging, metrics, tracing
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes |
| `packages/agents` | ✅ Yes (via memory) |
| `packages/memory` | ✅ Yes |
| `apps/ValyntApp` | ❌ No |

Frontend apps must **never** import infrastructure directly.
