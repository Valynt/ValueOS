---
description: Run all linting and auto-fix issues
---

# Lint and Fix Workflow

// turbo-all

## Auto-Fix All Issues

1. Fix ESLint issues:

```bash
pnpm lint -- --fix
```

2. Fix CSS/styling issues:

```bash
# No auto-fix for CSS, run lint to check
pnpm lint
```

3. Check and fix inline styles:

```bash
node scripts/check-inline-styles.cjs
```

## Validation

4. Validate OpenAPI spec:

```bash
node scripts/validate-openapi.mjs
```

5. Validate Tailwind config:

```bash
node scripts/validate-tailwind-config.js
```

6. Run all lints to verify:

```bash
pnpm lint
```

## Console Cleanup

7. Remove debug console.logs:

```bash
bash scripts/cleanup-console-logs.sh
```

## Pre-Commit Check

8. Run all checks that pre-commit would run:

```bash
pnpm lint && npx tsc --noEmit
```
