---
description: Run the full test suite with proper environment setup
---

# Running Tests in ValueOS

// turbo-all

1. Ensure dependencies are installed:

```bash
pnpm install
```

2. Run unit tests with Vitest:

```bash
pnpm test
```

3. Run integration tests:

```bash
npx vitest --config .config/configs/vitest.config.integration.ts --run
```

**Windows/PowerShell**: To limit output (equivalent to `head -50`):

```powershell
npx vitest --config .config/configs/vitest.config.integration.ts --run --reporter=verbose 2>&1 | Select-Object -First 50
```

4. Run end-to-end tests with Playwright:

```bash
npx playwright test
```

5. Check test coverage:

```bash
pnpm run test:coverage
```

## Notes

- Tests require environment variables from `.env.test`
- Playwright tests require a running dev server
- Use `pnpm test:watch` for all tests in watch mode
