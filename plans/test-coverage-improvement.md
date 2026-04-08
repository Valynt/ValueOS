# Test Coverage Improvement Plan

## Executive Summary

This plan identifies areas of the ValueOS codebase that are light on test coverage and provides actionable recommendations for implementing tests. The analysis covers backend services, workers, frontend hooks, components, and API routes.

## Coverage Analysis Methodology

- **Existing tests mapped**: Identified test files and their coverage scope
- **Code complexity assessed**: Evaluated based on business logic density, external dependencies, and failure modes
- **Risk prioritization**: Focused on critical paths (export pipeline, notifications, settings management)
- **Gap identification**: Found modules with zero or minimal test coverage

---

## Identified Test Gaps

### Priority 1: Critical Backend Services

#### 1.1 AsyncExportWorker (`packages/backend/src/workers/AsyncExportWorker.ts`)

**Current State**: No dedicated test file exists for this worker.

**Why It Matters**: This worker handles the entire async export pipeline (PDF/PPTX), including:
- Job processing with tenant context
- Progress tracking and event emission
- Error handling and retry logic
- Idempotency enforcement

**Recommended Tests**:
- `processJob()` - happy path for PPTX and PDF exports
- `processJob()` - error handling and failure state transitions
- `processPptxExport()` - progress callback mapping
- `processPdfExport()` - renderUrl validation and progress tracking
- `createAsyncExportWorker()` - worker configuration and queue metrics
- Idempotency - duplicate job prevention
- Tenant isolation - cross-tenant data access prevention

**Estimated Test Count**: 8-10 tests

#### 1.2 ExportJobRepository (`packages/backend/src/services/export/ExportJobRepository.ts`)

**Current State**: No dedicated test file exists.

**Why It Matters**: This is the data access layer for export jobs, enforcing tenant isolation and managing the full job lifecycle.

**Recommended Tests**:
- `create()` - job creation with progress step initialization
- `findActiveJob()` - idempotency query correctness
- `findById()` - tenant isolation enforcement
- `findCompletedByCase()` - filtering and ordering
- `markRunning()` / `markCompleted()` / `markFailed()` - state transitions
- `updateProgress()` - progress step array mutation
- `cancel()` - state validation before cancellation
- `createEvent()` / `getEvents()` - event lifecycle
- `refreshSignedUrl()` - URL expiry handling

**Estimated Test Count**: 10-12 tests

#### 1.3 PdfExportService (`packages/backend/src/services/export/PdfExportService.ts`)

**Current State**: Has minimal tests (`__tests__/PdfExportService.test.ts`) covering only singleton pattern.

**Why It Matters**: Generates PDFs using Puppeteer with fallback behavior, uploads to storage, and returns signed URLs.

**Recommended Tests**:
- `exportValueCase()` - successful PDF generation and upload
- `exportValueCase()` - storage upload failure handling
- `exportValueCase()` - signed URL generation with expiry
- Puppeteer fallback - HTML download when Chrome unavailable
- Progress callback invocation during export
- SSRF prevention - renderUrl validation

**Estimated Test Count**: 6-8 tests (in addition to existing 2)

#### 1.4 PptxExportService (`packages/backend/src/services/export/PptxExportService.ts`)

**Current State**: Has minimal tests (`__tests__/PptxExportService.test.ts`) covering only Supabase client selection.

**Why It Matters**: Generates PowerPoint presentations with multiple slide types, fetching data from multiple repositories.

**Recommended Tests**:
- `exportValueCase()` - full deck generation with all slide types
- Title slide - owner name handling
- Executive summary slide - narrative draft integration
- Financial model slide - ROI, NPV, payback period rendering
- Hypotheses slide - data aggregation and formatting
- Storage upload and signed URL generation
- Progress callback invocation at each stage
- Missing data handling (no narrative, no financial model)

**Estimated Test Count**: 8-10 tests (in addition to existing 2)

---

### Priority 2: API Routes

#### 2.1 Notification Routes (`packages/backend/src/api/notifications.routes.ts`)

**Current State**: No dedicated test file exists.

**Why It Matters**: Handles SSE streaming for real-time notifications, with connection management and rate limiting.

**Recommended Tests**:
- SSE stream endpoint - connection setup and heartbeat
- SSE stream - initial batch of unread notifications
- SSE stream - client limit enforcement (MAX_SSE_CLIENTS)
- SSE stream - disconnect cleanup
- `getNotifications()` - pagination and filtering
- `getNotifications()` - tenant isolation
- `markAsRead()` - single notification update
- `markAllAsRead()` - bulk update with optional ID filter
- `broadcastNotification()` - fan-out to connected clients
- Rate limiting - standard vs strict limiter application

**Estimated Test Count**: 10-12 tests

---

### Priority 3: Frontend Hooks

#### 3.1 useNotificationCenter (`apps/ValyntApp/src/hooks/useNotificationCenter.ts`)

**Current State**: No dedicated test file exists.

**Why It Matters**: Manages real-time notification state with SSE, React Query integration, and mark-as-read functionality.

**Recommended Tests**:
- Initial notification fetch via React Query
- Mark as read mutation and cache invalidation
- Mark all as read mutation
- SSE connection management (connect/disconnect)
- SSE event handling - new notification arrival
- Unread count calculation
- Loading and error states
- Disabled query when tenant/user context missing

**Estimated Test Count**: 8-10 tests

#### 3.2 useKeyboardShortcuts (`apps/ValyntApp/src/hooks/useKeyboardShortcuts.ts`)

**Current State**: No dedicated test file exists.

**Why It Matters**: Global keyboard shortcut handler with context-aware actions and modifier key support.

**Recommended Tests**:
- Default shortcuts registration
- Custom shortcuts override
- Modifier key combinations (Ctrl, Alt, Shift, Meta)
- Context-aware shortcut filtering
- Handler invocation and return value handling
- Help modal toggle
- Enabled/disabled state
- preventDefault behavior
- Key event filtering (input elements excluded)
- Last shortcut tracking

**Estimated Test Count**: 10-12 tests

#### 3.3 useSettings (`apps/ValyntApp/src/hooks/useSettings.ts`)

**Current State**: No dedicated test file exists.

**Why It Matters**: Core settings management hook with optimistic updates, validation, dirty tracking, and permission-aware access.

**Recommended Tests**:
- Settings fetch via React Query
- `updateSetting()` - mutation and optimistic update
- `updateSetting()` - error rollback
- Dirty tracking - markDirty/markClean
- Revert to original values
- `canEdit` permission enforcement
- Validation error handling
- Field error management
- Settings audit log query
- Bulk save coordination

**Estimated Test Count**: 10-12 tests

---

### Priority 4: Frontend Components

#### 4.1 TeamSettings (`apps/ValyntApp/src/views/Settings/TeamSettings.tsx`)

**Current State**: No dedicated test file exists.

**Why It Matters**: Complex settings view with notification toggles, import/export, bulk save, and permission checks.

**Recommended Tests**:
- Loading state rendering
- Error state rendering
- Notification toggle interactions
- Bulk save with dirty fields
- Discard changes (revert)
- Export settings - JSON download
- Import settings - file validation and parsing
- Read-only access indicator
- Permission-based edit enforcement

**Estimated Test Count**: 8-10 tests

#### 4.2 OrganizationGeneral (`apps/ValyntApp/src/views/Settings/OrganizationGeneral.tsx`)

**Current State**: Has branding test file (`OrganizationGeneral.branding.test.tsx`) but limited coverage.

**Why It Matters**: Organization identity management with logo upload, branding preview, and theme application.

**Recommended Tests**:
- Loading state rendering
- Error state rendering
- Organization name/domain/industry/size field rendering
- Logo upload handler - file validation
- Logo removal handler
- Bulk save with dirty fields
- Branding preview rendering
- Read-only access indicator
- Permission-based edit enforcement
- Theme application on mount

**Estimated Test Count**: 8-10 tests (in addition to existing branding tests)

#### 4.3 HypothesisCard (`apps/ValyntApp/src/components/canvas/widgets/HypothesisCard.tsx`)

**Current State**: Has test file (`__tests__/HypothesisCard.test.tsx`) - verify coverage is adequate.

**Why It Matters**: Core widget for hypothesis management with accept/edit/reject/promote actions.

**Recommended Tests** (if gaps exist):
- Empty state rendering
- Single hypothesis rendering
- Evidence tier badge colors
- Status badge colors
- Accept action handler
- Reject action handler
- Edit action handler
- Promote to assumption action (when canPromote=true)
- Benchmark reference display
- Data validation helper

**Estimated Test Count**: 5-8 tests (verify existing coverage first)

---

### Priority 5: API Client

#### 5.1 UnifiedApiClient (`apps/ValyntApp/src/api/client/unified-api-client.ts`)

**Current State**: Has minimal tests (`__tests__/unified-api-client.test.ts`) covering input sanitization and X-Request-ID header.

**Why It Matters**: Central API client with retry logic, interceptors, error handling, and response transformation.

**Recommended Tests**:
- Request interceptor chain execution
- Response interceptor chain execution
- Error interceptor chain execution
- Retry logic - exponential backoff
- Retry logic - max attempts exhaustion
- Timeout handling
- Response transformation (success/error)
- Error response transformation
- Auth token header injection
- Default headers merging
- Path parameter sanitization edge cases

**Estimated Test Count**: 10-12 tests (in addition to existing 4)

---

## Implementation Strategy

### Phase 1: Critical Backend Tests (Week 1-2)

Focus on the export pipeline which has zero test coverage for core logic:

1. **AsyncExportWorker tests** - 8-10 tests
2. **ExportJobRepository tests** - 10-12 tests
3. **PdfExportService additional tests** - 6-8 tests
4. **PptxExportService additional tests** - 8-10 tests

**Total Phase 1**: ~32-40 tests

### Phase 2: API Route Tests (Week 2-3)

Cover the notification system API:

1. **Notification Routes tests** - 10-12 tests

**Total Phase 2**: ~10-12 tests

### Phase 3: Frontend Hook Tests (Week 3-4)

Test the React hooks that drive user-facing features:

1. **useNotificationCenter tests** - 8-10 tests
2. **useKeyboardShortcuts tests** - 10-12 tests
3. **useSettings tests** - 10-12 tests

**Total Phase 3**: ~28-34 tests

### Phase 4: Frontend Component Tests (Week 4-5)

Complete coverage for settings views and verify existing component tests:

1. **TeamSettings tests** - 8-10 tests
2. **OrganizationGeneral additional tests** - 8-10 tests
3. **HypothesisCard coverage verification** - 5-8 tests

**Total Phase 4**: ~21-28 tests

### Phase 5: API Client Enhancement (Week 5)

Extend the unified API client tests:

1. **UnifiedApiClient additional tests** - 10-12 tests

**Total Phase 5**: ~10-12 tests

---

## Summary

| Phase | Area | Test Count | Priority |
|-------|------|------------|----------|
| 1 | Backend Export Pipeline | 32-40 | P0 |
| 2 | Notification API Routes | 10-12 | P1 |
| 3 | Frontend Hooks | 28-34 | P1 |
| 4 | Frontend Components | 21-28 | P2 |
| 5 | API Client Enhancement | 10-12 | P2 |
| **Total** | | **101-126 tests** | |

---

## Test Architecture Recommendations

### Backend Testing Patterns

- Use Vitest with Supabase mock clients
- Mock BullMQ workers with job data fixtures
- Use factory pattern for test data generation
- Enforce tenant isolation in every test

### Frontend Testing Patterns

- Use React Testing Library for component tests
- Mock React Query with QueryClientProvider
- Use custom render wrappers with auth/tenant context
- Test user interactions, not implementation details

### Shared Testing Principles

- Test behavior, not implementation
- One assertion per test where possible
- Descriptive test names following "should X when Y" pattern
- Use factories for test data, not inline objects

---

## Files to Create

```
packages/backend/src/workers/__tests__/AsyncExportWorker.test.ts
packages/backend/src/services/export/__tests__/ExportJobRepository.test.ts
packages/backend/src/api/__tests__/notifications.routes.test.ts
apps/ValyntApp/src/hooks/__tests__/useNotificationCenter.test.ts
apps/ValyntApp/src/hooks/__tests__/useKeyboardShortcuts.test.ts
apps/ValyntApp/src/hooks/__tests__/useSettings.test.ts
apps/ValyntApp/src/views/Settings/__tests__/TeamSettings.test.tsx
apps/ValyntApp/src/views/Settings/__tests__/OrganizationGeneral.test.tsx (extend existing)
```

## Files to Extend

```
packages/backend/src/services/export/__tests__/PdfExportService.test.ts
packages/backend/src/services/export/__tests__/PptxExportService.test.ts
apps/ValyntApp/src/api/client/__tests__/unified-api-client.test.ts
apps/ValyntApp/src/components/canvas/widgets/__tests__/HypothesisCard.test.tsx (verify coverage)
```
