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

**Windows/PowerShell**: To limit output (equivalent to `head -50`):

```powershell
npx vitest --config .config/configs/vitest.config.integration.ts --run --reporter=verbose 2>&1 | Select-Object -First 50
```

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
