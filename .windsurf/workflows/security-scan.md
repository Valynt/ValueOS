---
description: Run comprehensive security scans on the codebase
---

# Security Scanning Workflow

// turbo-all

## Quick Security Audit

1. Run npm security audit:

```bash
npm run security:scan
```

2. Run Snyk vulnerability scan (if configured):

```bash
npm run security:scan:snyk
```

3. Check RLS policies:

```bash
npm run test:rls
```

4. Test for data leakage:

```bash
npm run test:rls:leakage
```

## Deep Security Scan

5. Run security hammer tests:

```bash
tsx scripts/security-hammer.ts
```

6. Run red team canary token checks:

```bash
tsx scripts/red-team-canary-tokens.ts
```

7. Validate tenant RLS isolation:

```bash
tsx scripts/validate-tenant-rls.ts
```

## Review Checklist

- [ ] No high/critical vulnerabilities in npm audit
- [ ] RLS policies pass all tests
- [ ] No tenant data leakage detected
- [ ] Security hammer tests pass
