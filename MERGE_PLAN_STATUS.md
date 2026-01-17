# Legacy ValyntApp UI Merge Plan — Status Update

**Date:** 2025-01-17
**Current Phase:** Batch 1 ✅ Complete — Batch 2 Planning

---

## ✅ Batch 1: Core Types (COMPLETE)

**Branch:** `merge/types-batch-1`
**Commits:**

- `b7a66108`: Staged types in `legacy-merge/types` (vos, workflow, execution, agents)
- `a5bbd1de`: Merged types to production (`apps/ValyntApp/src/types/`)

**Files Merged:**

- `vos.ts` — VOS lifecycle types (Opportunity, Target, Realization, Expansion stages)
- `workflow.ts` — Workflow DAG and execution types
- `execution.ts` — ExecutionIntent and ExecutionEntrypoint types
- `agents.ts` — Agent taxonomy (10 agents) and message types
- `lib/agent-fabric/types.d.ts` — Type stub for imports

**Status:** ✅ **TypeScript validation passed** — No compilation errors

---

## 🔄 Batch 2: Core Services (PLANNED — Ready to Execute)

**Services to Merge:**

1. `SessionManager.ts` (9.5 KB) — Session lifecycle and timeout management
2. `AuthService.ts` (16.9 KB) — Authentication and token handling
3. `ContinuousAuthService.ts` (10.7 KB) — Background token refresh

**Dependencies Needed:**

- `BaseService` — Base class for all services
- `errors` — Custom error types
- `SecurityLogger` — Audit logging for auth events
- `../lib/logger` — Application logger
- `MFAService` — Multi-factor authentication
- `ClientRateLimit` — Rate limiting
- `CSRFProtection` — CSRF token handling

**Strategy:**

1. Copy service files to `legacy-merge/services`
2. Create minimal stubs for helper modules (`BaseService`, `errors`, etc.)
3. Run targeted TypeScript validation
4. Merge to production with CI verification
5. Run unit tests for auth services

**Timeline:** Next autonomous execution phase

---

## 📊 Overall Progress

| Batch | Category                | Files | Status      |
| ----- | ----------------------- | ----- | ----------- |
| 1     | Types                   | 5     | ✅ Complete |
| 2     | Services (Auth)         | 3     | 🔄 Planning |
| 3     | Services (Integrations) | 6–10  | 📋 Queued   |
| 4     | Components              | 20    | 📋 Queued   |
| 5     | Pages & Routing         | 14    | 📋 Queued   |
| 6     | Integration Adapters    | 9     | 📋 Queued   |

---

## 🎯 Next Actions (Autonomous)

1. **Create service helper stubs** in `legacy-merge/lib/`
2. **Stage all 3 auth services** in `legacy-merge/services`
3. **Run TypeScript validation** for batch 2
4. **Create branch `merge/services-batch-1`** and commit staged files
5. **Merge services to production** with CI gates

---

## 🔗 Related Files

- Sprint Plan: `untitled:plan-mergeLegacyValyntAppUi.prompt.md`
- Type Inventory: `inventory/valynt-legacy-files.csv`
- Diffs: `diff-outputs/services.diff` (large, ~4 MB)
