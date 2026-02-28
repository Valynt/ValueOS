---
description: Add a new feature to ValueOS following best practices
---

# New Feature Development Workflow

## Planning Phase (Use Planning Mode in Windsurf)

1. Define the feature scope and acceptance criteria
2. Identify affected components:
   - Frontend: `src/components/`, `src/pages/`
   - Backend/Services: `src/services/`
   - Database: `supabase/migrations/`
   - Tests: `tests/`

## Implementation

3. Create feature branch (if using git flow):

```bash
git checkout -b feature/<feature-name>
```

4. Implement database changes first (if any):
   - See `/database-migration` workflow

5. Implement backend/service layer

6. Implement frontend components

7. Add unit tests:

```bash
pnpm test:watch
```

## Quality Checks

// turbo 8. Run linting:

```bash
pnpm lint
```

// turbo 9. Run type check:

```bash
pnpm typecheck
```

10. Run full test suite:

```bash
pnpm test
```

11. Run accessibility tests (for UI features):

```bash
npx playwright test tests/accessibility/axe-a11y.spec.ts
```

## Documentation

12. Update relevant documentation in `docs/`

13. Update OpenAPI spec if API changes

## Review Checklist

- [ ] Feature meets acceptance criteria
- [ ] Unit tests added (aim for 80%+ coverage)
- [ ] Integration tests for critical paths
- [ ] No lint errors
- [ ] Types are correct
- [ ] Accessibility tests pass (for UI)
- [ ] Documentation updated
