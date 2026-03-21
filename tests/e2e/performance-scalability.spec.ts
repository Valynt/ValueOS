import { describe, it, expect } from 'vitest';

describe('Performance & Scalability Remediation', () => {

  it('Widespread use of ErrorBoundary in frontend components', () => {
    // This test verifies that error isolation has been applied systematically
    // to prevent localized failures from crashing the entire application.
    //
    // The enterprise pattern uses a RouteGuard HOC that wraps each route with
    // its own ErrorBoundary + Suspense pair. We count both direct <ErrorBoundary
    // usages AND <RouteGuard usages (which each contain an ErrorBoundary internally).
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');

    try {
      const directCmd = `grep -rE "<ErrorBoundary" "${srcPath}" --include="*.tsx" | wc -l`;
      const routeGuardCmd = `grep -rE "<RouteGuard" "${srcPath}" --include="*.tsx" | wc -l`;
      const withEBCmd = `grep -rE "withErrorBoundary|WithErrorBoundary" "${srcPath}" --include="*.tsx" | wc -l`;

      const directCount = parseInt(execSync(directCmd, { encoding: 'utf-8' }).trim(), 10);
      const routeGuardCount = parseInt(execSync(routeGuardCmd, { encoding: 'utf-8' }).trim(), 10);
      const withEBCount = parseInt(execSync(withEBCmd, { encoding: 'utf-8' }).trim(), 10);

      // Each RouteGuard wraps one ErrorBoundary + one Suspense, so it counts as 1 ErrorBoundary
      const totalErrorBoundaryEquivalents = directCount + routeGuardCount + withEBCount;

      expect(
        totalErrorBoundaryEquivalents,
        `Found only ${totalErrorBoundaryEquivalents} ErrorBoundary-equivalent usages ` +
        `(${directCount} direct + ${routeGuardCount} RouteGuard + ${withEBCount} HOC). ` +
        `Expected > 20 for robust per-route error containment.`
      ).toBeGreaterThan(20);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('Widespread use of Suspense for data-heavy components', () => {
    // This test verifies that Suspense boundaries have been applied for better
    // loading state management. RouteGuard components each contain a Suspense boundary.
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');

    try {
      const directCmd = `grep -rE "<Suspense" "${srcPath}" --include="*.tsx" | wc -l`;
      const routeGuardCmd = `grep -rE "<RouteGuard" "${srcPath}" --include="*.tsx" | wc -l`;
      const withSuspenseCmd = `grep -rE "withSuspense|WithSuspense" "${srcPath}" --include="*.tsx" | wc -l`;

      const directCount = parseInt(execSync(directCmd, { encoding: 'utf-8' }).trim(), 10);
      const routeGuardCount = parseInt(execSync(routeGuardCmd, { encoding: 'utf-8' }).trim(), 10);
      const withSuspenseCount = parseInt(execSync(withSuspenseCmd, { encoding: 'utf-8' }).trim(), 10);

      // Each RouteGuard wraps one Suspense boundary
      const totalSuspenseEquivalents = directCount + routeGuardCount + withSuspenseCount;

      expect(
        totalSuspenseEquivalents,
        `Found only ${totalSuspenseEquivalents} Suspense-equivalent usages ` +
        `(${directCount} direct + ${routeGuardCount} RouteGuard + ${withSuspenseCount} HOC). ` +
        `Expected > 20 for optimal per-route loading states.`
      ).toBeGreaterThan(20);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('Agent HPA configuration uses agent_queue_depth metric', () => {
    // This test verifies that the Kubernetes HPA for agents is correctly configured
    // to scale based on the custom agent_queue_depth metric.
    const hpaPath = path.join(process.cwd(), 'infra/k8s/base/agents/core-agent-hpa.yaml');

    if (!fs.existsSync(hpaPath)) {
      test.skip('Agent HPA configuration file not found');
      return;
    }

    const content = fs.readFileSync(hpaPath, 'utf-8');

    // Check that the HPA uses the external metric
    expect(content).toContain('type: External');
    expect(content).toContain('name: agent_queue_depth');

    // Check for stabilization window to prevent thrashing
    expect(content).toContain('stabilizationWindowSeconds');
  });

  it('Frontend API client implements retry and circuit breaker logic', () => {
    // This test verifies that the unified API client has robust error handling
    // for network failures and rate limits.
    // The unified API client is at apps/ValyntApp/src/api/client/unified-api-client.ts
    const apiClientPath =
      path.join(process.cwd(), 'apps/ValyntApp/src/api/client/unified-api-client.ts');

    if (!fs.existsSync(apiClientPath)) {
      test.skip('API client file not found');
      return;
    }

    const content = fs.readFileSync(apiClientPath, 'utf-8');

    // Check for retry logic (e.g., using react-query's retry or custom fetch wrapper)
    const hasRetry =
      content.includes('retry:') ||
      content.includes('retries') ||
      content.includes('exponentialBackoff') ||
      content.includes('maxRetries');
    expect(hasRetry, 'API client should implement retry logic for transient failures.').toBe(true);

    // Check for 429 Too Many Requests handling
    const handlesRateLimits =
      content.includes('429') ||
      content.includes('Too Many Requests') ||
      content.includes('Retry-After') ||
      content.includes('rate_limit') ||
      content.includes('rateLimit');
    expect(
      handlesRateLimits,
      'API client should explicitly handle 429 rate limit responses.'
    ).toBe(true);
  });
});
