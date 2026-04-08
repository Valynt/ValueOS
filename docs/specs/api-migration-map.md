# API Migration Map — tRPC/REST Hybrid Resolution

**Status**: Draft  
**Owner**: Frontend lead  
**Date**: 2026-04-07

---

## Current State

The ValyntApp frontend uses two API clients:

| Client | Location | Usage |
|--------|----------|-------|
| **REST** (unified) | `src/api/client/unified-api-client.ts` | 111 files, dominant client |
| **tRPC** | `src/lib/trpc.ts` | 3 files: `useAuth.ts`, `AppProviders.tsx`, `trpc.ts` |

## Endpoint Inventory

### tRPC Endpoints (via `@trpc/react-query`)

| Procedure | Consumer | Migration | Notes |
|-----------|----------|-----------|-------|
| Auth (login, session, refresh) | `useAuth.ts` | **Keep tRPC** | Complex auth flow, session streaming |

### REST Endpoints (via `unified-api-client.ts`)

| Endpoint Group | File Count | Migration | Notes |
|----------------|-----------|-----------|-------|
| Cases CRUD | ~15 files | **Stable** | Already REST |
| Journey/Orchestrator | ~5 files | **Stable** | Already REST |
| SDUI render | ~4 files | **Stable** | Already REST |
| Agent jobs/streaming | ~10 files | **Stable** | Already REST |
| Value tree/graph | ~8 files | **Stable** | Already REST |
| Settings/admin | ~12 files | **Stable** | Already REST |
| Billing/subscription | ~6 files | **Stable** | Already REST |
| Integrations | ~8 files | **Stable** | Already REST |
| Team/permissions | ~6 files | **Stable** | Already REST |
| Company context | ~5 files | **Stable** | Already REST |
| ESO (SEC/BLS/Census) | ~3 files | **Stable** | Already REST |
| Exports | ~3 files | **Stable** | Already REST |

## Decision

**No migration needed.** The REST client is already dominant. tRPC is used only
for auth where its streaming capabilities are valuable.

- All new warmth/mode/review APIs use the unified REST client
- tRPC stays for auth only
- No endpoints need to be migrated between clients

## New Endpoints Required (Phase 1-3)

| Endpoint | Method | Phase | Purpose |
|----------|--------|-------|---------|
| `/api/cases/:id` | GET | 1 | Add `warmth_state` and `confidence_score` to response |
| `/api/cases/:id/warmth-history` | GET | 2 | Warmth transition timeline |
| `/api/cases/:id/events` | GET (SSE) | 2 | Real-time workspace events |
| `/api/users/me/mode-preference` | GET/PUT | 2 | Workspace mode preference |
| `/api/cases/:id/review` | GET | 3 | Executive reviewer data |
| `/api/cases/:id/review/approve` | POST | 3 | Approval workflow |

### Response Shape Changes

**Existing** `GET /api/cases/:id` response — add fields:
```json
{
  "id": "...",
  "saga_state": "VALIDATING",
  "workflow_status": "completed",
  "confidence_score": 0.78,
  "warmth_state": "firm",
  "warmth_modifier": null
}
```

The `warmth_state` and `warmth_modifier` can be derived server-side using
`deriveWarmth()` from `packages/shared/src/domain/Warmth.ts`, or derived
client-side from `saga_state` + `confidence_score`. Client-side derivation
is preferred to keep the contract simple.

## Risk

**Low risk.** No existing endpoints need migration. New endpoints are additive.
The only change to existing responses is adding optional fields to the case
response, which is backward-compatible.
