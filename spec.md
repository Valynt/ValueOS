# ValueOS Frontend: Enterprise B2B SaaS Readiness

**Scope:** `apps/ValyntApp` · `packages/components`  
**Tracks:** Design System & Theming · Component Polish & a11y · State & Error Handling · Production Readiness & Testing

---

## Problem Statement

The ValyntApp frontend has functional core workflows (SDUI, agentic canvas, lifecycle stages) but the presentation layer has gaps that undermine trust with enterprise buyers: `ThemeProvider` is not wired into the app tree so dark mode never activates; `SettingsPage.tsx` renders hardcoded mock data; the `CommandPaletteProvider` is a stub that only logs; canvas widgets lack keyboard navigation; i18n coverage is limited to auth views; `CanvasHost` has no error isolation; and Storybook/E2E coverage does not extend to V1 surfaces.

---

## Track 1: Design System & Theming

### 1.1 Wire ThemeProvider into the app tree

**Current state:** `ThemeProvider` exists at `src/app/providers/ThemeProvider.tsx` and correctly toggles `.dark` on `<html>`. However it is not included in `AppProviders.tsx` or `AppRoutes.tsx`, so the `.dark` class is never applied and dark mode is non-functional.

**Tasks:**
- Add `ThemeProvider` as the outermost wrapper in `AppProviders.tsx` (wrapping `TrpcProvider`).
- Verify `valueos-theme.css` `.dark {}` block already has full semantic token overrides — it does; no CSS changes needed.

**Acceptance criteria:**
- Toggling theme via `useTheme().setTheme("dark")` applies `.dark` to `<html>` and all semantic tokens (`--background`, `--foreground`, `--card`, etc.) resolve to dark values.
- `UserAppearance.tsx` theme toggle is functional end-to-end.

### 1.2 Audit and replace hardcoded color values

**Current state:** `SettingsPage.tsx` and several other views use raw Tailwind zinc/gray/emerald classes (`bg-zinc-50`, `text-zinc-400`, `border-zinc-200`) instead of semantic tokens. Grep count: 816 occurrences across `src/views/`.

**Tasks:**
- In `SettingsPage.tsx`: replace all `bg-zinc-*`, `text-zinc-*`, `border-zinc-*` with semantic equivalents (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`).
- Apply the same replacement to the highest-traffic views: `Dashboard.tsx`, `Opportunities.tsx`, `IntegrityDashboard.tsx`, `DealAssemblyWorkspace.tsx`, `ValueModelWorkbench.tsx`.
- Do not touch test files or Storybook stories during this pass.

**Acceptance criteria:**
- No `bg-zinc-*` / `text-zinc-*` / `border-zinc-*` remain in the targeted files.
- Visual appearance is unchanged in light mode; dark mode renders correctly.

### 1.3 Refactor SettingsPage.tsx — remove mock data, connect to real hooks

**Current state:** `SettingsPage.tsx` is the active `/settings` route. It contains hardcoded data: `defaultValue="Acme Corp"`, a static `users` array (Sarah Chen, James Park, etc.), static API key fixtures, and static billing figures. The modular `SettingsView` / `SettingsLayout` system exists but is not routed.

**Decision:** Refactor `SettingsPage.tsx` in-place (do not change the route).

**Tasks:**
- `OrgTab`: replace `defaultValue="Acme Corp"` with data from `useTenant()` (`currentTenant.name`, `currentTenant.slug`). Wire the Save button to `PATCH /api/v1/tenant` via `apiClient`.
- `UsersTab`: replace the static `users` array with a `useOrganizationUsers()` hook call (or `apiClient.get("/api/v1/tenant/users")`). Show a skeleton while loading; show `EmptyState` when the list is empty.
- `ApiKeysTab`: replace static `keys` array with `apiClient.get("/api/v1/tenant/api-keys")`. Wire Create/Delete actions to the corresponding endpoints.
- `BillingTab`: replace static plan/usage data with `apiClient.get("/api/v1/billing/summary")`.
- `SecurityTab`: wire MFA toggle and session timeout to `apiClient.patch("/api/v1/tenant/security")`.
- Replace all hardcoded zinc classes in this file (covered by task 1.2).
- Add `useToast()` calls for all mutation success/failure paths.

**Acceptance criteria:**
- No hardcoded user names, email addresses, plan names, or usage figures remain in `SettingsPage.tsx`.
- All tabs show skeleton loaders while fetching and `EmptyState` when data is absent.
- Save/Create/Delete actions show toast feedback.

---

## Track 2: Component Polish & Accessibility

### 2.1 Implement CommandPalette (⌘K)

**Current state:** `CommandPaletteProvider` is a stub that calls `logger.debug`. `CommandBar.tsx` is a fully implemented AI query modal (keyboard nav, suggestions, submit). `TopBar.tsx` has a ⌘K button that calls `onCommandBarOpen` prop but the prop is never wired to the stub provider.

**Decision:** Full navigation + AI palette — app navigation shortcuts plus AI query.

**Tasks:**
- Extend `CommandPaletteProvider` with `open: boolean` state and a global `keydown` listener for `⌘K` / `Ctrl+K`.
- Add navigation commands to the palette: Dashboard, Opportunities, Models, Agents, Integrations, Settings — each with a keyboard shortcut label and `useNavigate()` action.
- Wire `CommandBar.tsx` as the UI layer: open it when `open === true`, pass `onClose` and `onSubmit` (AI query handler).
- In `TopBar.tsx`, replace the `onCommandBarOpen` prop call with `useCommandPalette().openCommandPalette()`.
- Ensure the modal traps focus (already implemented in `CommandBar.tsx` — verify it works with the new provider wiring).

**Acceptance criteria:**
- `⌘K` / `Ctrl+K` opens the palette from anywhere in the authenticated app.
- Navigation items are listed and keyboard-selectable (arrow keys + Enter).
- Submitting a query string calls the AI handler.
- `Escape` closes the palette and returns focus to the previously focused element.

### 2.2 Promote NotificationCenter from wireframe to production

**Current state:** `NotificationCenter.tsx` lives in `src/components/wireframes/` and is a complete, well-structured component (AnimatePresence, category filters, mark-as-read, live pulse). It uses internal mock data.

**Tasks:**
- Move `NotificationCenter.tsx` to `src/components/shell/NotificationCenter.tsx`.
- Replace internal mock `notifications` array with a `useNotifications()` hook that fetches from `GET /api/v1/notifications` (or subscribes to Supabase Realtime channel `notifications:user_id`).
- Add a bell icon button to `TopBar.tsx` that toggles the panel open/closed.
- Wire "mark as read" actions to `PATCH /api/v1/notifications/:id/read`.
- Add `aria-label="Notifications"` to the trigger button; ensure the panel has `role="dialog"` and `aria-modal="true"`.

**Acceptance criteria:**
- Notification bell appears in `TopBar`.
- Panel opens/closes with correct focus management (focus moves into panel on open, returns to trigger on close).
- Unread count badge updates when notifications arrive.
- Mark-as-read persists via API.

### 2.3 Accessibility remediation on canvas widgets

**Current state:** `StakeholderMap.tsx` and `GapResolution.tsx` have partial keyboard support. `HypothesisCard.tsx`, `ScenarioComparison.tsx`, and `InlineEditor.tsx` have no `tabIndex`, `onKeyDown`, or `aria-label` attributes on their interactive elements.

**Tasks:**
- `HypothesisCard.tsx`: add `tabIndex={0}` and `onKeyDown` (Enter/Space → trigger primary action) to each hypothesis card container. Add `aria-label` to Accept/Edit/Reject buttons (icon-only buttons need labels).
- `ScenarioComparison.tsx`: add keyboard navigation between scenario columns; add `role="group"` and `aria-label` to each scenario column.
- `InlineEditor.tsx`: ensure the edit trigger is keyboard-accessible; add `aria-label="Edit [field name]"` to the edit icon button.
- `ReadinessGauge.tsx`: add `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` to the gauge element.
- `ProvenancePanel.tsx` (in `packages/components/components/`): verify focus trap on open; add `aria-label` to close button.

**Acceptance criteria:**
- All interactive canvas widgets are fully keyboard-navigable (Tab to reach, Enter/Space to activate).
- All icon-only buttons have `aria-label`.
- `ReadinessGauge` exposes meter semantics to screen readers.
- No axe-core violations on the targeted widgets.

### 2.4 Responsive design for data-heavy views

**Current state:** `ValueModelWorkbench.tsx` and `AssumptionRegister.tsx` use desktop-first fixed layouts with no responsive breakpoints.

**Tasks:**
- `AssumptionRegister.tsx`: wrap the table in `overflow-x-auto` on mobile; add `sm:` breakpoints to column widths so the table scrolls horizontally rather than overflowing.
- `ValueModelWorkbench.tsx`: audit the two-panel layout; add `flex-col` on `sm:` and `flex-row` on `lg:` so panels stack vertically on tablet.
- Review `DealAssemblyWorkspace.tsx` and `IntegrityDashboard.tsx` for similar issues.

**Acceptance criteria:**
- No horizontal overflow on viewports >= 375px wide.
- Data tables scroll horizontally on small screens rather than clipping.

---

## Track 3: State, Data Fetching & Error Handling

### 3.1 Standardize EmptyState across list views

**Current state:** `EmptyState` component exists at `src/components/common/EmptyState.tsx` and is used in `Dashboard.tsx` and `IntegrityStage.tsx`. `Opportunities.tsx` and `IntegrityDashboard.tsx` do not use it.

**Tasks:**
- Audit `Opportunities.tsx`, `IntegrityDashboard.tsx`, and `RealizationTracker.tsx` for missing empty states.
- Add `<EmptyState>` renders when the respective React Query hooks return empty arrays.
- Ensure all list views handle `isLoading` (skeleton) and `isError` (Alert) states — not just empty.

**Acceptance criteria:**
- No list view renders a blank screen when data is absent, loading, or errored.
- `EmptyState` is used consistently across Dashboard, Opportunities, IntegrityDashboard, RealizationTracker.

### 3.2 Wrap CanvasHost and complex widgets in ErrorBoundary

**Current state:** `CanvasHost.tsx` uses `React.lazy` + `Suspense` for widget loading but has no `ErrorBoundary`. A single widget render error crashes the entire canvas. `ErrorBoundary` component exists at `src/components/ErrorBoundary.tsx` (also at `src/components/common/ErrorBoundary.tsx`).

**Tasks:**
- In `CanvasHost.tsx`: wrap each widget render in an `ErrorBoundary` with a compact fallback (not full-screen) that shows the widget ID and a retry button.
- Add a top-level `ErrorBoundary` around the entire `CanvasHost` as a second safety net.
- Verify `DealAssemblyWorkspace`, `ValueModelWorkbench`, `IntegrityDashboard`, and `ExecutiveOutputStudio` each have an `ErrorBoundary` at the page level (currently only `AppRoutes` has one at the root).

**Acceptance criteria:**
- A widget that throws during render shows an inline error fallback without crashing sibling widgets.
- The page-level error boundary catches errors outside the canvas.

### 3.3 Standardize toast notifications for mutations

**Current state:** `useToast` hook and `ToastProvider` exist. Only `ValueCaseCanvas.tsx` uses toasts for mutations. Hypothesis accept/reject, inline edits, and settings saves have no feedback.

**Tasks:**
- Add `useToast()` calls to: `HypothesisCard` accept/edit/reject actions, `InlineEditor` save action, `SettingsPage` all tab save/create/delete actions (covered in 1.3), `TenantSwitcher` switch success/failure.
- Standardize: success toasts use `variant: "success"`, error toasts use `variant: "destructive"`.

**Acceptance criteria:**
- Every mutation (create/update/delete) in the targeted components shows a toast on success and on failure.
- No silent failures.

### 3.4 i18n: extract all user-facing strings

**Current state:** `I18nProvider` and `useI18n()` hook exist. `en/common.json` has 20 keys covering only auth strings. V1 surface views (`DealAssemblyWorkspace`, `ValueModelWorkbench`, `IntegrityDashboard`, `ExecutiveOutputStudio`, `RealizationTracker`) have zero `t()` calls.

**Decision:** Extract strings from all user-facing views under `src/views/` and `src/components/`.

**Tasks:**
- Expand `en/common.json` with keys for: navigation labels, settings section titles, canvas widget labels (hypothesis, assumption, scenario, evidence), action button labels (Accept, Reject, Edit, Save, Cancel), status labels (loading, error, empty states), toast messages.
- Replace hardcoded strings in all V1 surface views with `t("key")` calls using `useI18n()`.
- Replace hardcoded strings in `SettingsPage.tsx` tab labels, field labels, and button text.
- Replace hardcoded strings in `TopBar.tsx`, `Sidebar.tsx`, `CommandBar.tsx`.
- Mirror all new keys to `es/common.json` with placeholder translations (same English value prefixed with `[ES]` to make untranslated strings visible).

**Acceptance criteria:**
- `en/common.json` covers all user-visible strings in targeted files.
- No hardcoded English UI strings remain in V1 surface views or shell components.
- Switching locale to `es` shows `[ES]` prefixed strings, confirming the pipeline works.

---

## Track 4: Production Readiness & Testing

### 4.1 Remove remaining mock data and stubs

**Current state:** `GuestAccessPage.tsx` has a `// Mock value case data` comment block with a hardcoded `ValueCaseData` interface and inline fixture. `CommandPaletteProvider` is a stub (resolved in 2.1). `SettingsPage.tsx` mock data resolved in 1.3.

**Tasks:**
- `GuestAccessPage.tsx`: replace the hardcoded `ValueCaseData` fixture with a fetch from `GET /api/v1/guest/cases/:valueCaseId` using the guest token from the URL. Show a loading skeleton and error state.
- Scrub remaining `// Mock`, `// Stub`, `// TODO` comments in `src/views/` and `src/pages/` — either implement or file as tracked debt in `debt.md`.

**Acceptance criteria:**
- `GuestAccessPage` fetches real case data using the guest token.
- No `// Mock` or `// Stub` comments remain in production view files.

### 4.2 Storybook stories for V1 SDUI widgets

**Current state:** Storybook stories exist only for 5 design-system primitives (`Button`, `Input`, `Label`, `Tooltip`, `Dialog`) and 2 settings views (`UserAppearance`, `UserNotifications`). No stories exist for canvas widgets.

**Tasks:**
- Create `HypothesisCard.stories.tsx` with stories: `Loading`, `Empty`, `WithPendingHypotheses`, `WithAcceptedHypotheses`, `WithRejectedHypotheses`.
- Create `ReadinessGauge.stories.tsx` with stories: `Low` (score < 40), `Medium` (40-70), `High` (> 70), `Loading`.
- Create `ProvenancePanel.stories.tsx` with stories: `Open` (with evidence items), `Empty`, `Loading`.
- Each story must use realistic fixture data (no lorem ipsum).

**Acceptance criteria:**
- `pnpm storybook` renders all three new story files without errors.
- Each story covers loading, empty, and populated states.

### 4.3 Playwright E2E tests for V1 critical flows

**Current state:** E2E tests cover: app startup, main layout skip-link, tenant branding render. No tests cover V1 workspace flows.

**Tasks:**
- Add `e2e/deal-assembly.spec.ts`: test the Deal Assembly flow — navigate to a workspace, verify `StakeholderMap` and `GapResolution` widgets render, submit a gap fill, verify the widget updates.
- Add `e2e/value-modeling.spec.ts`: navigate to the Value Model Workbench, verify `HypothesisCard` widgets render, accept a hypothesis, verify status badge updates.
- Add `e2e/executive-output.spec.ts`: navigate to Executive Output Studio, verify the output generation trigger is present and clickable.
- Tests must use the existing Playwright config (`apps/ValyntApp/playwright.config.ts`) and the `debug-login.ts` helper for authentication.

**Acceptance criteria:**
- All three new spec files pass in CI (`pnpm --filter ValyntApp exec playwright test`).
- Tests do not rely on hardcoded fixture data — they use the authenticated user's actual tenant data or seed data.

---

## Implementation Order

Tasks are ordered to minimize merge conflicts and unblock downstream work:

1. **1.1** Wire `ThemeProvider` — unblocks dark mode verification in all subsequent UI work
2. **1.2** Replace hardcoded zinc colors in targeted views
3. **1.3** Refactor `SettingsPage.tsx` — remove mock data, connect hooks, add toasts
4. **3.2** Wrap `CanvasHost` in `ErrorBoundary` — safety net before touching widgets
5. **2.1** Implement `CommandPalette` (navigation + AI)
6. **2.2** Promote `NotificationCenter` to production
7. **2.3** a11y remediation on canvas widgets
8. **2.4** Responsive breakpoints for data-heavy views
9. **3.1** Standardize `EmptyState` across list views
10. **3.3** Standardize toast notifications for mutations
11. **3.4** i18n string extraction (all views)
12. **4.1** Remove remaining mock data / stubs
13. **4.2** Storybook stories for V1 widgets
14. **4.3** Playwright E2E tests for V1 flows

---

## Files with Significant Changes

| File | Change |
|---|---|
| `src/app/providers/AppProviders.tsx` | Add `ThemeProvider` wrapper |
| `src/views/SettingsPage.tsx` | Remove all mock data; connect to API hooks; replace zinc classes; add toasts |
| `src/components/CommandPalette.tsx` | Full implementation: state, global keydown, navigation commands, AI query |
| `src/components/shell/TopBar.tsx` | Wire ⌘K to `useCommandPalette()`; add notification bell |
| `src/components/shell/NotificationCenter.tsx` | Promoted from wireframes; connected to API/Realtime |
| `src/components/canvas/CanvasHost.tsx` | Add per-widget `ErrorBoundary` |
| `src/components/canvas/widgets/HypothesisCard.tsx` | tabIndex, onKeyDown, aria-labels |
| `src/components/canvas/widgets/ScenarioComparison.tsx` | Keyboard nav, aria-label |
| `src/components/canvas/widgets/InlineEditor.tsx` | Keyboard-accessible edit trigger |
| `src/components/canvas/widgets/ReadinessGauge.tsx` | role="meter", aria-value* |
| `src/i18n/locales/en/common.json` | Expand from 20 to ~200+ keys |
| `src/views/DealAssemblyWorkspace.tsx` | i18n, zinc to semantic tokens |
| `src/views/ValueModelWorkbench.tsx` | i18n, responsive breakpoints, zinc to semantic tokens |
| `src/views/IntegrityDashboard.tsx` | i18n, EmptyState, zinc to semantic tokens |
| `src/views/ExecutiveOutputStudio.tsx` | i18n, zinc to semantic tokens |
| `src/views/RealizationTracker.tsx` | i18n, EmptyState |
| `src/pages/guest/GuestAccessPage.tsx` | Replace mock fixture with API fetch |
| `apps/ValyntApp/e2e/` | 3 new Playwright spec files |
| `packages/components/components/` | 3 new Storybook story files |

---

## Constraints & Notes

- **No default exports.** All new components and hooks use named exports (per `AGENTS.md`).
- **No `any`.** Current ceiling in `ValyntApp` is 58 usages. Do not increase it.
- **Tenant isolation.** Any new API calls in settings/notifications must include `organization_id` in the request.
- **`LegacyTenantRouteBridge`** must not be removed — it handles legacy URL redirects and is still needed.
- **`TenantSwitcher`** already fires `TENANT_CACHE_CLEAR_EVENT` via `clearAndBroadcastTenantCacheReset()` — task 2.1.3 from the original spec is already complete; do not re-implement.
- **`AgentChatSidebar`** already has focus trapping and `aria-modal="true"` — task 2.2.3 from the original spec is already complete for this component.
- **`DealAssemblyWorkspace`** already handles `isLoading` and `isError` — no changes needed for task 3.1.2 on this file.
