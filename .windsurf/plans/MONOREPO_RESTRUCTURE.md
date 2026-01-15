# Packages Restructure Plan

Move backend/shared code from `src/` to `packages/` with proper monorepo structure.

---

## Task 1: Create `packages/backend/`

```
packages/backend/
├── package.json      # @valueos/backend, no React
├── tsconfig.json     # Node target, no JSX
└── src/
    ├── server.ts     ← src/backend/server.ts
    ├── routes/       ← src/backend/routes/
    ├── api/          ← src/api/
    └── middleware/   ← src/middleware/
```

**Move:**

- `src/backend/*` → `packages/backend/src/`
- `src/api/*` → `packages/backend/src/api/`
- `src/middleware/*` → `packages/backend/src/middleware/`

---

## Task 2: Create `packages/mcp/`

```
packages/mcp/
├── package.json      # @valueos/mcp
├── tsconfig.json
├── common/           ← src/mcp-common/
├── crm/              ← src/mcp-crm/
└── ground-truth/     ← src/mcp-ground-truth/
```

---

## Task 3: Create `packages/sdui/`

```
packages/sdui/
├── package.json      # @valueos/sdui
├── tsconfig.json
└── src/              ← src/sdui/
```

---

## Task 4: Update Root Config

**package.json:**

```json
{
  "workspaces": ["packages/*"]
}
```

**tsconfig.json paths:**

```json
{
  "paths": {
    "@backend/*": ["./packages/backend/src/*"],
    "@mcp/*": ["./packages/mcp/*"],
    "@sdui/*": ["./packages/sdui/src/*"]
  }
}
```

---

## Task 5: Verify

1. `npm install`
2. `npm run typecheck`
3. `npm run backend:dev`

---

## Existing packages (no changes needed)

- `packages/sdui-types/` ✅
- `packages/components/` ✅
- `packages/services/` ✅

---

## Hard Rules

| Rule                                    | Enforcement       |
| --------------------------------------- | ----------------- |
| ❌ No React in backend/, mcp/           | package.json deps |
| ❌ No app-specific code in packages/\*  | Code review       |
| ❌ No frontend imports from @backend/\* | ESLint rule       |
