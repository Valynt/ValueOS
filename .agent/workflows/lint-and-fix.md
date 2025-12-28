---
description: Run all linting and auto-fix issues
---

# Lint and Fix Workflow

// turbo-all

## Auto-Fix All Issues

1. Fix ESLint issues:

```bash
npm run lint:fix
```

2. Fix CSS/styling issues:

```bash
npm run lint:css -- --fix
```

3. Check and fix inline styles:

```bash
npm run lint:inline-check
```

## Validation

4. Validate OpenAPI spec:

```bash
npm run lint:openapi
```

5. Validate Tailwind config:

```bash
npm run check:tw-config
```

6. Run all lints to verify:

```bash
npm run lint:all
```

## Console Cleanup

7. Remove debug console.logs:

```bash
npm run lint:console
```

## Pre-Commit Check

8. Run all checks that pre-commit would run:

```bash
npm run lint && npx tsc --noEmit
```
