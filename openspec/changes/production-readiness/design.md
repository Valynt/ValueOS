# Design: Production Readiness

## Technical Approach

Direct code fixes, CI configuration changes, and documentation. No new services or architectural changes.

## Architecture Decisions

### Decision: ESLint no-console enforcement

Replace `console.log` with structured logger (`winston`) in all backend code. Enable ESLint `no-console` rule to prevent regression.

### Decision: CI coverage gates

Raise CI coverage thresholds to lines=75%, functions=70%, branches=70%. Fail builds that drop below.

### Decision: DAST as CI gate

OWASP ZAP scan runs on every PR. High-severity findings fail the pipeline.

## Key Files

- `packages/backend/src/versioning.ts` — Fix unreachable code
- `eslint.config.js` — Add no-console rule
- `vitest.config.ts` — Raise coverage thresholds
- `.github/workflows/` — Add DAST gate
- `infra/observability/SLOs.md` — New SLO document
- `config/release-risk/` — Waiver tracking
