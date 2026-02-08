# Build Tracing & Logging Scripts

## Robust Build Tracing

Use the provided script to run any build (or test) command and capture all output, errors, and warnings for later inspection:

```sh
./scripts/trace-build.sh [build command]
```

- Example:
  ```sh
  ./scripts/trace-build.sh pnpm run build
  ./scripts/trace-build.sh docker compose build
  ```
- Output is saved to a timestamped log file (e.g., `build-20260208-153000.log`).
- Errors and warnings are summarized at the end of the run.

## Structured Logging in Code

ValueOS uses a robust, PII-safe logger:

- Import and use in any TypeScript/Node.js file:
  ```ts
  import { logger } from '@shared/src/lib/logger';
  logger.info('Build started', { buildId });
  logger.error('Build failed', error, { step: 'compile' });
  ```
- All logs are sanitized for PII and formatted for both local and production environments.
- See `packages/shared/src/lib/logger.ts` for advanced usage and integration with monitoring tools.

## CI Integration

- To capture build logs in CI, prefix your build/test steps with `./scripts/trace-build.sh` and upload the resulting log file as an artifact on failure.

---

For more details, see the main README and logger source code.
