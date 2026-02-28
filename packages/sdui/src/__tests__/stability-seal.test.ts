import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

/**
 * Final "Stability Seal" test suite.
 *
 * This is the gate that must pass before a build is declared production
 * ready.  It exercises the high–level build, lint, and RLS checks so that
 * the rest of the repo can rely on them being green.
 *
 * In CI we run `npx vitest --run` on all test files, so any failure here will
 * block merges to `main`.  Local developers can also run this file directly
 * when preparing a release candidate.
 */
describe('Stability Seal', () => {
  it('builds the app and passes lint/RLS checks', () => {
    // note: these commands may be slow, but they only run when the stability
    // suite is executed (CI prod branch or explicit invocation).
    execSync('pnpm run build --filter apps/ValyntApp', { stdio: 'inherit' });
    execSync('pnpm run lint', { stdio: 'inherit' });
    execSync('pnpm run test:rls', { stdio: 'inherit' });

    // if the commands above exit non‑zero the test will error before this
    expect(true).toBe(true);
  });
});
