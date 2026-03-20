# Spec: Fix bg-surface-elevated Missing from Tailwind Config

## Problem Statement

The Phase 2 dark design refactor introduced `bg-surface-elevated` in 27 places across the codebase (mapped from `bg-zinc-800`). The CSS variable `--surface-elevated` is correctly defined in `valueos-theme.css` for both light and dark modes, but the token was never registered in `tailwind.config.ts`. Tailwind silently discards unrecognised utility classes, so all 27 usages — primarily `hover:bg-surface-elevated` on buttons and interactive elements — produce no visual effect.

## Root Cause

`tailwind.config.ts` registers `surface` but not `surface-elevated`:

```ts
// current — incomplete
surface: "hsl(var(--surface))",
// missing:
// "surface-elevated": "hsl(var(--surface-elevated))",
```

## Requirements

1. Add `"surface-elevated": "hsl(var(--surface-elevated))"` to the `colors` block in `tailwind.config.ts`, immediately after the existing `surface` entry.
2. No other files need to change — the 27 usages of `bg-surface-elevated` and `hover:bg-surface-elevated` are already correct once the token is registered.

## Acceptance Criteria

- [ ] `tailwind.config.ts` contains `"surface-elevated": "hsl(var(--surface-elevated))"` in the `colors.extend` block
- [ ] `bg-surface-elevated` and `hover:bg-surface-elevated` produce a visible background in the running app
- [ ] `pnpm run check` (typecheck) passes
- [ ] `pnpm run lint` introduces no new errors

## Implementation

1. Edit `apps/ValyntApp/tailwind.config.ts` — add `"surface-elevated"` color key after `surface`
2. Verify with `pnpm run check && pnpm run lint`
