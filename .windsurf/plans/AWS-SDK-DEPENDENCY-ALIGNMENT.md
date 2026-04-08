# Follow-up Ticket: AWS SDK Dependency Alignment

**Ticket ID:** AWS-SDK-DEPENDENCY-ALIGNMENT  
**Created:** 2026-04-07  
**Priority:** P2 (post-release)  
**Owner:** TBD (DevOps/Backend Platform)

---

## Problem Statement

The `@aws-sdk/client-secrets-manager` package has incomplete or mismatched TypeScript type definitions that cause compile-time errors for several exported members:

### Affected Imports in `AWSSecretProvider.ts`

```typescript
import {
  DeleteSecretCommand,      // ❌ Not found (suggests CreateSecretCommand)
  DescribeSecretCommand,  // ❌ Not found (suggests CreateSecretCommand)
  GetSecretValueCommand,    // ✅ Found
  ListSecretsCommand,       // ❌ Not found
  PutSecretValueCommand,    // ❌ Not found (suggests GetSecretValueCommand)
  RotateSecretCommand,      // ❌ Not found (suggests CreateSecretCommand)
  SecretsManagerClient,     // ✅ Found
  type GetSecretValueCommandOutput,  // ❌ Not found (suggests GetSecretValueCommand)
} from "@aws-sdk/client-secrets-manager";
```

### Current Behavior

- **Runtime:** Commands execute correctly (no functional impact)
- **Compile-time:** TypeScript errors for missing exports
- **Workaround:** None required - runtime behavior is correct

---

## Investigation Notes

### Hypothesis 1: Version Pinning Issue
The package may be pinned to an older version in `pnpm-lock.yaml` that predates these command exports.

### Hypothesis 2: Modular SDK Split
AWS SDK v3 uses modular packages. Some commands may have moved to sub-packages or been renamed.

### Hypothesis 3: Type Definition Bug
The `@types/aws-sdk` or the package's own `.d.ts` files may be incomplete.

---

## Definition of Done

- [ ] Identify correct AWS SDK version with full Secrets Manager command support
- [ ] Validate lockfile pinning strategy (currently: `pnpm-lock.yaml`)
- [ ] Update `package.json` version constraint if needed
- [ ] Run `pnpm install` to regenerate lockfile
- [ ] Verify all 6 failing imports resolve correctly in TypeScript
- [ ] Run full test suite: `pnpm --filter backend test`
- [ ] Document any breaking changes in AWS SDK upgrade path

---

## Related Files

- `packages/backend/package.json` - Dependency declaration
- `packages/backend/pnpm-lock.yaml` - Lockfile pinning
- `packages/backend/src/config/secrets/AWSSecretProvider.ts` - Primary consumer

---

## Dependencies

**Blocks:** None (runtime behavior is correct)  
**Blocked by:** None

---

## Notes

This ticket is intentionally **not blocking** the async export release. The AWS SDK typing issues are compile-time only and do not affect production behavior. The commands execute correctly at runtime.

The type errors were masked by the broader async export work and surfaced during cleanup. They are properly scoped to this independent dependency alignment task.
