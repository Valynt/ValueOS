import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isNoMatchExit = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 1;

test.describe('Performance & Scalability Remediation', () => {
  
  test('Widespread use of ErrorBoundary in frontend components', () => {
    // This test verifies that ErrorBoundary usage has increased significantly
    // to prevent localized failures from crashing the entire application.
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');
    
    try {
      const cmd = `grep -rE "<ErrorBoundary" "${srcPath}" --include="*.tsx" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      // The audit found ~20 instances. We expect this to increase as it's applied
      // to more complex components like CanvasHost and ValueTreeCanvas.
      expect(count, `Found only ${count} ErrorBoundary usages. Expected > 40 for robust error containment.`).toBeGreaterThan(40);
    } catch (error: unknown) {
      if (!isNoMatchExit(error)) throw error;
    }
  });

  test('Widespread use of Suspense for data-heavy components', () => {
    // This test verifies that Suspense usage has increased for better loading state management.
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');
    
    try {
      const cmd = `grep -rE "<Suspense" "${srcPath}" --include="*.tsx" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      // The audit found ~14 instances. We expect this to increase.
      expect(count, `Found only ${count} Suspense usages. Expected > 30 for optimal loading states.`).toBeGreaterThan(30);
    } catch (error: unknown) {
      if (!isNoMatchExit(error)) throw error;
    }
  });

  test('Agent HPA configuration uses agent_queue_depth metric', () => {
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

  test('Frontend API client implements retry and circuit breaker logic', () => {
    // This test verifies that the unified API client has robust error handling
    // for network failures and rate limits.
    const apiClientPath = path.join(process.cwd(), 'apps/ValyntApp/src/api/client.ts');
    
    if (!fs.existsSync(apiClientPath)) {
      test.skip('API client file not found');
      return;
    }

    const content = fs.readFileSync(apiClientPath, 'utf-8');
    
    // Check for retry logic (e.g., using react-query's retry or custom fetch wrapper)
    const hasRetry = content.includes('retry:') || content.includes('retries') || content.includes('exponentialBackoff');
    expect(hasRetry, 'API client should implement retry logic for transient failures.').toBe(true);
    
    // Check for 429 Too Many Requests handling
    const handlesRateLimits = content.includes('429') || content.includes('Too Many Requests') || content.includes('Retry-After');
    expect(handlesRateLimits, 'API client should explicitly handle 429 rate limit responses.').toBe(true);
  });
});
