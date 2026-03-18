---
name: react-live-data-wiring
description: >
  Audit a React/TypeScript frontend for hardcoded mock data, wire views to live
  Supabase or REST API hooks with proper loading/empty states, build graceful-fallback
  data hooks, and apply consumer-grade shell polish (page transitions, scrollbars,
  font rendering, topbar/sidebar refinements). Use when asked to "wire up live data",
  "replace mock data", "connect to the real API", "make the UI production-ready",
  "polish the shell", or "consumer-grade UX". Triggers on: mock data, hardcoded data,
  live API, wire views, loading states, empty states, skeleton, shell polish, page
  transition, scrollbar, font rendering, topbar, sidebar refinement.
---

## Workflow

### Phase 1 — Audit

Run the audit script to find all mock data signals before touching any files:

```bash
bash .gitpod/skills/react-live-data-wiring/scripts/audit-mock-data.sh <src_dir>
```

The script outputs files sorted by signal count. Prioritize files with the most signals.

For each flagged file, classify the mock pattern:
- **Inline array** (`const items = [{ id: "...", ... }]`) — replace with a data hook
- **Simulated fetch** (`setTimeout + return MOCK_DATA`) — replace with real API call
- **Static state** (`useState([{ ... }])`) — replace with query hook, remove useState
- **Placeholder comment** (`// TODO: replace with real data`) — implement the hook

### Phase 2 — Choose the right hook pattern

Read `references/hook-patterns.md` for full code examples of each pattern.

| Situation | Pattern |
|---|---|
| Reading a first-class DB table (cases, users, orgs) | Direct Supabase hook via `CasesService` / `useQuery` |
| Backend has per-item endpoint but no list endpoint | API hook with static fallback (`Promise.allSettled` + `placeholderData`) |
| Backend returns a different shape than the frontend type | Fetch-and-transform hook (pure `transform()` function + `emptyGraph()` null object) |

**Always:**
- Gate queries with `enabled: !!tenantId` (or equivalent) — never fire without context
- Use `placeholderData` to show static/empty content immediately while fetching
- Define a pure `derive*()` function for each display field — never store derived state
- Handle all three states in every view: loading (skeleton), empty (CTA), populated

### Phase 3 — Wire the view

For each view being wired:

1. Remove the hardcoded array / mock constant
2. Import the hook: `const { data, isLoading } = useXxx()`
3. Derive display fields with pure functions: `const stage = deriveStage(c)`
4. Replace the render with the three-state pattern:

```tsx
{isLoading
  ? <SkeletonGrid count={4} />
  : items.length === 0
    ? <EmptyState />
    : items.map((item) => <Card key={item.id} item={item} />)
}
```

5. Skeleton components must match the real card's dimensions exactly — same grid, same height, `animate-pulse` on zinc-200 placeholder blocks
6. Empty state must include a call-to-action, not just "No data found"

### Phase 4 — Shell polish

Apply only when the shell feels visually heavy or unrefined. Read `references/shell-polish.md` for exact values.

Apply in this order (each is independent):

1. **Global CSS** — font rendering + thin scrollbars + `scrollbar-gutter: stable`
2. **TopBar** — reduce to `h-14`, lighten border to `zinc-100`, add `backdrop-blur-sm`, shrink buttons, add `active:scale-[0.98]` to primary CTA
3. **Sidebar** — lighten all borders to `zinc-100`, reduce nav item height to `min-h-10`, add `shadow-sm` to active state, reduce collapse toggle size
4. **Page transition** — add `PageTransition` wrapper around `<Outlet />` using `requestAnimationFrame` + CSS `transition-opacity duration-150`

Do not use Framer Motion for page transitions. Do not animate `height` or `width`. Do not apply `backdrop-blur` to the sidebar.

### Phase 5 — Verify

Start the dev server and confirm:
- No TypeScript errors in the wired views
- Loading skeletons appear briefly on first load
- Empty state renders when the tenant has no data
- Navigation transitions are smooth (no flash)
- Scrollbars are thin and unobtrusive

## References

- `references/hook-patterns.md` — Full code for all three hook patterns, loading/empty state checklist. Read when choosing or implementing a hook.
- `references/shell-polish.md` — Exact CSS/Tailwind values for TopBar, Sidebar, MainLayout, global CSS. Read when applying the polish pass.
- `scripts/audit-mock-data.sh` — Grep-based scanner. Run at the start of every audit.
