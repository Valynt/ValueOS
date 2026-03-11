# ADR-0011 — DI Container Removal; Module-Level Singletons as Replacement

**Status:** Accepted  
**Date:** 2026-06-10  
**Deciders:** Engineering

---

## Context

A full .NET-style DI container (`ServiceCollection`, `ServiceProvider`, `SERVICE_TOKENS`) was built in `services/DependencyInjectionContainer.ts` (289 LOC) and imported in 8 files. `createServiceCollection()` was never called outside the container file itself. No service was ever registered. `hasService()` was called in `UnifiedAgentAPI` as a guard, always returned false, and silently fell back to direct construction.

Evidence: `grep -rn "createServiceCollection|addSingleton|addTransient|addFactory" packages/backend/src` returned zero results outside `DependencyInjectionContainer.ts` itself.

The actual pattern used everywhere in the codebase is module-level singletons:
- `getUnifiedAgentAPI()` — lazy singleton in `UnifiedAgentAPI.ts`
- `getAgentAPI()` — lazy singleton in `AgentAPI.ts`
- `getDirectFactory()` — lazy singleton in `api/agents.ts`

---

## Decision

**Delete `DependencyInjectionContainer.ts`.** Replace the `hasService` guard in `UnifiedAgentAPI` with direct construction (which is what already happened at runtime). Module-level singletons remain the standard pattern for shared service instances.

**Module-level singleton pattern:**

```typescript
let _instance: MyService | null = null;
export function getMyService(): MyService {
  if (!_instance) _instance = new MyService(config);
  return _instance;
}
```

---

## Consequences

- Removes 289 LOC of infrastructure that did nothing.
- Eliminates a confusing false dependency: code that imported `hasService` appeared to support DI-based construction but always fell through to direct construction.
- Tests continue to mock at the module level (already the practice).
- The theoretical ability to swap implementations via DI is lost. In practice this was never used — tests mock at the module boundary, not via the container.

---

## Alternatives Considered

**Keep the container, populate it:** Rejected. The codebase has 193 services; wiring them into a DI container is weeks of work with no runtime benefit over the existing singleton pattern. The singleton pattern is simpler, explicit, and already used everywhere.

**Replace with a lightweight container (tsyringe, inversify):** Rejected for the same reason. The complexity cost exceeds the benefit given the existing singleton pattern works correctly.
