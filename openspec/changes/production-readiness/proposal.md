# Proposal: Production Readiness

## Intent

Close material gaps in code quality, test coverage, API documentation, observability, and operational readiness required for enterprise B2B launch.

## Scope

In scope:
- Fix API versioning middleware bug (unreachable code)
- TypeScript `any` reduction below thresholds
- Test coverage thresholds enforcement in CI
- Service deduplication (ValueTreeService)
- Structured logging (replace console.log)
- DAST gate enforcement in CI
- OpenAPI spec coverage expansion
- SLO/SLI documentation
- Release waiver tracking with expiry
- Legacy directory removal

Out of scope:
- Feature development
- Agent refactoring
- Database migrations unrelated to operational readiness

## Approach

Flat prioritized task list. P0 items are launch-blocking. P1 items are high-priority quality improvements. Each task is independently shippable and must pass the existing test suite.
