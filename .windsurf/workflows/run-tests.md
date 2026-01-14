---
description: Run the full test suite with proper environment setup
---

# Running Tests in ValueOS

// turbo-all

1. Ensure dependencies are installed:

```bash
npm install
```

2. Run unit tests with Vitest:

```bash
npm run test:unit
```

3. Run integration tests:

```bash
npm run test:integration
```

4. Run Playwright E2E tests:

```bash
npx playwright test
```

5. Check test coverage:

```bash
npm run test:coverage
```

## Notes

- Tests require environment variables from `.env.test`
- Playwright tests require a running dev server
- Use `npm run test` for all tests in watch mode
