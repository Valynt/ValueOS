# CI/CD & Quality Gates

This document describes the CI/CD guardrails and the local commands that mirror them.

## Quality Gates (Local = CI)

Run the same checks locally that CI enforces:

```bash
pnpm run ci:verify
```

This runs:

- ESLint linting
- TypeScript typechecking
- Vitest test suite (coverage enforced by config)
- Production build

## Security Scans

Run dependency and SBOM scans locally:

```bash
npm run security:scan
npm run security:sbom
```

### Secret Scanning (Local)

The CI pipeline runs TruffleHog for secret scanning. For local scans, install TruffleHog or use Docker:

```bash
docker run --rm -v "$(pwd)":/repo trufflesecurity/trufflehog:latest filesystem /repo
```

## CI Summary

CI runs on pull requests and pushes to main/develop:

- Lint
- Typecheck
- Tests
- Build
- Dependency audit
- Secret scanning
- SBOM generation

Artifacts:

- Test coverage reports
- Build outputs
- SBOM
