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
npm run test:unit -- --watch
```

## Quality Checks

// turbo 8. Run linting:

```bash
npm run lint:all
```

// turbo 9. Run type check:

```bash
npx tsc --noEmit
```

10. Run full test suite:

```bash
npm run test:all
```

11. Run accessibility tests (for UI features):

```bash
npm run test:a11y
```

## Documentation

12. Update relevant documentation in `docs/`

13. Update OpenAPI spec if API changes:

```bash
npm run lint:openapi
```

## Review Checklist

- [ ] Feature meets acceptance criteria
- [ ] Unit tests added (aim for 80%+ coverage)
- [ ] Integration tests for critical paths
- [ ] No lint errors
- [ ] Types are correct
- [ ] Accessibility tests pass (for UI)
- [ ] Documentation updated
