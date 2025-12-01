/**
 * SDUI Error Resilience Test
 * 
 * Validates that SDUI components fail gracefully and don't crash the app.
 * Production Readiness: HIGH Priority
 */

import { test, expect } from '@playwright/test';

test.describe('SDUI Error Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with SDUI components
    await page.goto('/dashboard');
  });

  test('should catch errors in agent-generated components', async ({ page }) => {
    // Simulate agent returning invalid component data
    await page.route('**/api/agents/**/invoke', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          component: {
            type: 'InvalidComponent', // Non-existent component
            props: {}
          }
        })
      });
    });

    // Trigger agent invocation
    await page.click('[data-testid="invoke-agent"]');

    // Should show error boundary fallback, NOT crash
    await expect(page.locator('[data-testid="agent-error-fallback"]')).toBeVisible({
      timeout: 5000
    });

    // App should still be functional
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
  });

  test('should show circuit breaker fallback when breaker is open', async ({ page }) => {
    // Simulate circuit breaker open state
    await page.route('**/api/circuit-breaker/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agent: 'OpportunityAgent',
          state: 'open',
          failureCount: 5
        })
      });
    });

    await page.click('[data-testid="invoke-agent"]');

    // Should show circuit breaker fallback
    await expect(page.locator('[data-testid="circuit-breaker-fallback"]')).toBeVisible();
    await expect(page.locator('text=Circuit Breaker Active')).toBeVisible();
  });

  test('should handle malformed JSON in agent response', async ({ page }) => {
    await page.route('**/api/agents/**/invoke', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'INVALID JSON {{'
      });
    });

    await page.click('[data-testid="invoke-agent"]');

    // Should show validation error fallback
    await expect(page.locator('[data-testid="agent-validation-error-fallback"]')).toBeVisible();
  });

  test('should allow retry after error', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/agents/**/invoke', async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          body: 'Internal Server Error'
        });
      } else {
        // Retry succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            component: {
              type: 'MetricCard',
              props: { value: 100 }
            }
          })
        });
      }
    });

    await page.click('[data-testid="invoke-agent"]');
    await expect(page.locator('[data-testid="agent-error-fallback"]')).toBeVisible();

    // Click retry button
    await page.click('button:has-text("Retry")');

    // Should show successful component
    await expect(page.locator('[data-testid="metric-card"]')).toBeVisible();
  });

  test('should isolate errors to individual components', async ({ page }) => {
    // Load page with multiple SDUI components
    await page.goto('/dashboard/multi-agent');

    // Simulate one agent failing
    await page.route('**/api/agents/opportunity/invoke', async (route) => {
      await route.fulfill({ status: 500 });
    });

    await page.route('**/api/agents/target/invoke', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          component: { type: 'TargetCard', props: {} }
        })
      });
    });

    // Trigger both agents
    await page.click('[data-testid="load-all-agents"]');

    // First agent should show error
    await expect(page.locator('[data-testid="agent-error-fallback"]').first()).toBeVisible();

    // Second agent should load successfully
    await expect(page.locator('[data-testid="target-card"]')).toBeVisible();

    // Page should remain functional
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
  });
});

test.describe('SDUI Data Binding Safety', () => {
  test('should handle schema mismatches gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Return component with missing required props
    await page.route('**/api/agents/**/invoke', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          component: {
            type: 'MetricCard',
            props: {
              // Missing required 'value' prop
              label: 'Test'
            }
          }
        })
      });
    });

    await page.click('[data-testid="invoke-agent"]');

    // Should show validation error or fallback component
    const errorVisible = await page.locator('[data-testid="agent-validation-error-fallback"]').isVisible({ timeout: 2000 }).catch(() => false);
    const fallbackVisible = await page.locator('[data-testid="component-fallback"]').isVisible({ timeout: 2000 }).catch(() => false);

    expect(errorVisible || fallbackVisible).toBe(true);
  });
});
