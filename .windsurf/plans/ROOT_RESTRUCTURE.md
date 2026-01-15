# Root ValueOS Restructure Plan

Atomic restructure of root ValueOS project - `git mv` only, no logic changes.

---

## Phase 1: Config Files

| From | To | Status |
|------|-----|--------|
| `.config/configs/eslint.config.js` | `eslint.config.js` | Pending |
| `.config/configs/tsconfig.node.json` | `tsconfig.node.json` | Pending |
| Create | `prettier.config.cjs` | Pending |
| Create | `.env.example` | Pending |

## Phase 2: Public Assets

| From | To | Status |
|------|-----|--------|
| `public/vite.svg` | `public/favicon.svg` | Pending |
| Create | `public/robots.txt` | Pending |

## Phase 3: src/ Restructure

| From | To | Status |
|------|-----|--------|
| `src/index.css` | `src/styles/globals.css` | Pending |
| `src/AppRoutes.tsx` | `src/app/routes/index.tsx` | Pending |
| `src/contexts/` | `src/app/providers/` | Pending |
| `src/bootstrap.ts` | `src/app/bootstrap/init.ts` | Pending |
| `src/views/` | `src/pages/` | Pending |
| `src/components/Layout/` | `src/layouts/` | Pending |

## Phase 4: Import Updates

After moves, update all imports referencing moved files.

## Phase 5: Verification

- [ ] TypeScript passes
- [ ] Lint passes
- [ ] Build passes (if applicable)

---

## Notes

- Root project has NO vite.config.ts (only ValyntApp/mcp-dashboard have it)
- tsconfig.json already at root with path aliases
- This is frontend-only restructure, backend packages untouched
