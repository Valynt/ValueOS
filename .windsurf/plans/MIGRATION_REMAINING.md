# Migration Project - Complete Remaining Work

Comprehensive plan for all remaining work to complete the ValueOS → ValyntApp migration and monorepo restructure.

---

## Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **ValyntApp** | 95% Complete | tsconfig.node.json fix needed |
| **Packages Restructure** | Complete | backend, shared, infra, memory, agents, mcp, sdui |
| **Root ValueOS Restructure** | Not Started | Deferred after failed attempt |
| **Dependency Boundaries** | Documented | DEPENDENCY_POLICY.md exists |

---

## Phase 1: ValyntApp Final Polish (30 min)

### 1.1 Fix tsconfig.node.json
```
- Add "composite": true
- Add "declaration": true
- Change "noEmit": true to "emitDeclarationOnly": true
```

### 1.2 Verify Complete
```bash
cd ValyntApp
npm run typecheck  # Should pass
npm run lint       # 0 errors
npm run build      # Should succeed
```

### 1.3 Lock ValyntApp
- Commit as "feat: ValyntApp frontend complete"
- Tag as `valyntapp-v1.0.0` if desired

---

## Phase 2: Package Integration (1-2 hours)

### 2.1 Connect ValyntApp to @valueos/shared
```typescript
// ValyntApp/package.json - add workspace dependency
"dependencies": {
  "@valueos/shared": "^1.0.0"
}
```

Import **types only**:
```typescript
import type { Permission } from '@valueos/shared/types';
```

### 2.2 Split @valueos/shared (Optional but Recommended)
Create isomorphic/Node split:

| Current | Target |
|---------|--------|
| `shared/lib/logger.ts` | `shared-node/logger.ts` |
| `shared/lib/redisClient.ts` | `shared-node/redis.ts` |
| `shared/types/*` | `shared/types/*` (keep) |
| `shared/schemas/*` | `shared/schemas/*` (keep) |

### 2.3 Verify Package Boundaries
- ValyntApp → shared (types only) ✅
- ValyntApp → backend ❌ (HTTP only)
- backend → shared ✅
- backend → infra ✅
- backend → memory ✅
- backend → agents ✅

---

## Phase 3: Root ValueOS Restructure (2-3 hours)

**APPROACH**: One folder at a time, typecheck after each.

### 3.1 src/views → src/pages
```bash
git mv src/views/errors src/pages/errors
# typecheck
git mv src/views/Auth src/pages/auth
# typecheck
git mv src/views/Settings src/pages/settings
# typecheck
# ... continue for each subfolder
```

### 3.2 src/contexts → src/app/providers
```bash
mkdir -p src/app/providers
git mv src/contexts/AuthContext.tsx src/app/providers/
git mv src/contexts/DrawerContext.tsx src/app/providers/
# ... fix imports manually using editor
```

### 3.3 src/components/Layout → src/layouts
```bash
git mv src/components/Layout/* src/layouts/
rmdir src/components/Layout
```

### 3.4 Other Moves
| From | To |
|------|-----|
| `src/AppRoutes.tsx` | `src/app/routes/index.tsx` |
| `src/bootstrap.ts` | `src/app/bootstrap/init.ts` |
| `src/index.css` | `src/styles/globals.css` |

### 3.5 Update tsconfig.json Path Aliases
```json
"paths": {
  "@/*": ["./src/*"],
  "@pages/*": ["./src/pages/*"],
  "@layouts/*": ["./src/layouts/*"],
  "@app/*": ["./src/app/*"]
}
```

---

## Phase 4: Monorepo Finalization (1 hour)

### 4.1 Move ValyntApp to apps/
```
ValueOS/
├── apps/
│   └── ValyntApp/     # Move here
├── packages/
│   ├── backend/
│   ├── shared/
│   ├── infra/
│   ├── memory/
│   ├── agents/
│   ├── mcp/
│   ├── sdui/
│   └── components/
```

### 4.2 Update Root package.json Workspaces
```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### 4.3 Verify Workspace Dependencies
```bash
npm install  # Reinstall with new paths
npm run typecheck -ws  # All workspaces
```

---

## Phase 5: Cleanup (30 min)

### 5.1 Remove Obsolete Files
- `.config/configs/` (if copied to root)
- Duplicate config files
- Old migration plans

### 5.2 Update Documentation
- Update README.md with new structure
- Update CONTRIBUTING.md
- Archive old migration docs

### 5.3 Final Verification
```bash
npm run typecheck -ws
npm run lint -ws
npm run build -ws
npm run test -ws
```

---

## Execution Order (Recommended)

| Order | Phase | Risk | Time |
|-------|-------|------|------|
| 1 | ValyntApp Final Polish | Low | 30 min |
| 2 | Package Integration | Low | 1-2 hrs |
| 3 | Root src/ Restructure | **High** | 2-3 hrs |
| 4 | Monorepo Finalization | Medium | 1 hr |
| 5 | Cleanup | Low | 30 min |

**Total: ~6-8 hours**

---

## Decision Points

### Q1: Do root src/ restructure now or defer?
- **Now**: Cleaner long-term, one migration effort
- **Defer**: Ship ValyntApp first, restructure later

### Q2: Split @valueos/shared?
- **Yes**: Clean isomorphic boundary
- **No**: Use type-only imports, document carefully

### Q3: Move ValyntApp to apps/?
- **Yes**: Standard monorepo layout
- **No**: Keep at root for simpler paths

---

## Rules (Learned from Failed Attempt)

1. ❌ **No sed on imports** - Use editor/TS for refactoring
2. ❌ **No multiple moves at once** - One folder, then typecheck
3. ❌ **No mixing config + src changes** - Separate commits
4. ✅ **git mv only** - Let git track renames
5. ✅ **Typecheck after every logical chunk**
6. ✅ **Revert immediately if broken** - Don't "fix forward"
