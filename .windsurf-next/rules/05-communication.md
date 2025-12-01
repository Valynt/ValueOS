# Agent Communication

**Paths:** `src/services/MessageBus.ts` & `src/types/CommunicationEvent.ts`

- CloudEvents-compliant JSON protocol
- Default: Asynchronous (NO synchronous agent calls except Orchestrator)
- `trace_id` MUST propagate across all async boundaries
