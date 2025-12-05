---
trigger: always_on
---

# Memory Management

**Path:** `src/lib/agent-fabric/MemorySystem.ts`

- **CRITICAL:** All vector queries MUST filter `{ metadata: { tenant_id } }`
- NO direct agent-to-agent Working Memory access
- Share via `MessageBus` events or `SharedArtifacts` table
- `agent_audit_log` is append-only (NEVER update/delete)
