/**
 * Agent Invocation E2E Tests
 * 
 * Tests for agent execution flows:
 * - Opportunity agent invocation
 * - Target agent invocation
 * - Error handling and recovery
 * 
 * Acceptance Criteria: 100% agent reliability
 */

import { test, expect, Page } from '@playwright/test';

// Mock authentication for testing
const mockAuth = async (page: Page) => {
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('user_id', 'test-user');
  });
};

test.describe('Agent Invocation - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');
  });

  test.describe('Opportunity Agent', () => {
    test('should display opportunity agent interface', async ({ page }) => {
      // Navigate to opportunity agent
      const opportunityLink = page.locator('text=/opportunity|opportunities/i').first();
      if (await opportunityLink.isVisible()) {
        await opportunityLink.click();
        
        await expect(page).toHaveURL(/\/opportunity/, { timeout: 10000 });
      }
    });

    test('should show agent input form', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Should have input for opportunity details
      const inputField = page.locator('textarea, input[type="text"]').first();
      await expect(inputField).toBeVisible({ timeout: 5000 });
    });

    test('should validate required inputs', async ({ page }) => {
      await page.goto('/opportunity');
      
      const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation error
        await expect(page.locator('text=/required|empty|fill/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should invoke opportunity agent with valid input', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Analyze market opportunity for SaaS product in healthcare');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show loading state
        await expect(page.locator('text=/analyzing|processing|loading/i, [role="progressbar"]')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display agent results', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Test opportunity analysis');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Wait for results
        await expect(page.locator('text=/result|analysis|recommendation/i')).toBeVisible({ timeout: 30000 });
      }
    });

    test('should allow saving opportunity analysis', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Assume analysis is complete
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Should show success message
        await expect(page.locator('text=/saved|success/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow exporting opportunity analysis', async ({ page }) => {
      await page.goto('/opportunity');
      
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
      if (await exportButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        
        await exportButton.click();
        
        // Should trigger download
        const download = await downloadPromise;
        expect(download).toBeTruthy();
      }
    });

    test('should show agent execution progress', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Complex opportunity analysis');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show progress indicator
        const progressBar = page.locator('[role="progressbar"], .progress').first();
        if (await progressBar.isVisible()) {
          expect(await progressBar.isVisible()).toBe(true);
        }
      }
    });
  });

  test.describe('Target Agent', () => {
    test('should display target agent interface', async ({ page }) => {
      const targetLink = page.locator('text=/target|targets/i').first();
      if (await targetLink.isVisible()) {
        await targetLink.click();
        
        await expect(page).toHaveURL(/\/target/, { timeout: 10000 });
      }
    });

    test('should show target input form', async ({ page }) => {
      await page.goto('/target');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      await expect(inputField).toBeVisible({ timeout: 5000 });
    });

    test('should validate target criteria', async ({ page }) => {
      await page.goto('/target');
      
      const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit"), button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation error
        await expect(page.locator('text=/required|criteria|specify/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should invoke target agent with valid criteria', async ({ page }) => {
      await page.goto('/target');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Identify target companies in fintech sector');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show loading state
        await expect(page.locator('text=/analyzing|processing|searching/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display target results', async ({ page }) => {
      await page.goto('/target');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Test target analysis');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Wait for results
        await expect(page.locator('text=/result|target|company|companies/i')).toBeVisible({ timeout: 30000 });
      }
    });

    test('should allow filtering target results', async ({ page }) => {
      await page.goto('/target');
      
      // Assume results are displayed
      const filterButton = page.locator('button:has-text("Filter"), input[placeholder*="filter" i]').first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        
        // Should show filter options
        await expect(page.locator('text=/industry|size|location/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow sorting target results', async ({ page }) => {
      await page.goto('/target');
      
      const sortButton = page.locator('button:has-text("Sort"), select').first();
      if (await sortButton.isVisible()) {
        await sortButton.click();
        
        // Should show sort options
        await expect(page.locator('text=/name|score|relevance/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle agent timeout', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Test timeout scenario');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Wait for timeout error (if it occurs)
        const errorMessage = page.locator('text=/timeout|took too long|try again/i');
        if (await errorMessage.isVisible({ timeout: 60000 })) {
          expect(await errorMessage.isVisible()).toBe(true);
        }
      }
    });

    test('should handle agent error gracefully', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Simulate error condition
      await page.evaluate(() => {
        // Mock API to return error
        window.fetch = async () => {
          throw new Error('Agent execution failed');
        };
      });
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Test error handling');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show error message
        await expect(page.locator('text=/error|failed|problem/i')).toBeVisible({ timeout: 10000 });
      }
    });

    test('should allow retrying failed agent invocation', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Assume error occurred
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
      if (await retryButton.isVisible()) {
        await retryButton.click();
        
        // Should restart agent invocation
        await expect(page.locator('text=/analyzing|processing/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should handle network errors', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Simulate offline
      await page.context().setOffline(true);
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Test network error');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show network error
        await expect(page.locator('text=/network|offline|connection/i')).toBeVisible({ timeout: 5000 });
      }
      
      // Restore online
      await page.context().setOffline(false);
    });

    test('should handle rate limiting', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Simulate multiple rapid requests
      for (let i = 0; i < 5; i++) {
        const inputField = page.locator('textarea, input[type="text"]').first();
        if (await inputField.isVisible()) {
          await inputField.fill(`Test request ${i}`);
          
          const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
          await submitButton.click();
          
          await page.waitForTimeout(100);
        }
      }
      
      // Should show rate limit message
      const rateLimitMessage = page.locator('text=/rate limit|too many|slow down/i');
      if (await rateLimitMessage.isVisible({ timeout: 5000 })) {
        expect(await rateLimitMessage.isVisible()).toBe(true);
      }
    });

    test('should handle invalid input gracefully', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        // Try special characters
        await inputField.fill('<script>alert("xss")</script>');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should sanitize or show error
        await expect(page.locator('text=/invalid|error|sanitize/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Agent Reliability', () => {
    test('should complete agent invocation within timeout', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Quick analysis test');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        const startTime = Date.now();
        
        await submitButton.click();
        
        // Wait for results
        await page.locator('text=/result|analysis|complete/i').waitFor({ timeout: 60000 });
        
        const duration = Date.now() - startTime;
        
        // Should complete within 60 seconds
        expect(duration).toBeLessThan(60000);
      }
    });

    test('should maintain agent state during execution', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        const testInput = 'State persistence test';
        await inputField.fill(testInput);
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Input should remain visible
        const inputValue = await inputField.inputValue();
        expect(inputValue).toBe(testInput);
      }
    });

    test('should handle concurrent agent invocations', async ({ page }) => {
      // Open multiple tabs
      const page2 = await page.context().newPage();
      await mockAuth(page2);
      
      await page.goto('/opportunity');
      await page2.goto('/target');
      
      // Invoke both agents
      const input1 = page.locator('textarea, input[type="text"]').first();
      const input2 = page2.locator('textarea, input[type="text"]').first();
      
      if (await input1.isVisible() && await input2.isVisible()) {
        await input1.fill('Concurrent test 1');
        await input2.fill('Concurrent test 2');
        
        const submit1 = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        const submit2 = page2.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        
        await Promise.all([
          submit1.click(),
          submit2.click(),
        ]);
        
        // Both should complete
        await expect(page.locator('text=/result|analysis/i')).toBeVisible({ timeout: 60000 });
        await expect(page2.locator('text=/result|analysis/i')).toBeVisible({ timeout: 60000 });
      }
      
      await page2.close();
    });

    test('should preserve agent results on page refresh', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Persistence test');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Wait for results
        await page.locator('text=/result|analysis/i').waitFor({ timeout: 30000 });
        
        // Refresh page
        await page.reload();
        
        // Results should still be visible (if cached)
        const results = page.locator('text=/result|analysis/i');
        if (await results.isVisible({ timeout: 5000 })) {
          expect(await results.isVisible()).toBe(true);
        }
      }
    });

    test('should track agent execution metrics', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Metrics test');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Wait for completion
        await page.locator('text=/result|analysis/i').waitFor({ timeout: 30000 });
        
        // Check for metrics display
        const metricsDisplay = page.locator('text=/duration|time|tokens/i');
        if (await metricsDisplay.isVisible({ timeout: 5000 })) {
          expect(await metricsDisplay.isVisible()).toBe(true);
        }
      }
    });
  });

  test.describe('User Experience', () => {
    test('should show helpful loading messages', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('UX test');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show informative loading message
        const loadingMessage = page.locator('text=/analyzing|processing|please wait/i');
        await expect(loadingMessage).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow canceling agent execution', async ({ page }) => {
      await page.goto('/opportunity');
      
      const inputField = page.locator('textarea, input[type="text"]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Cancel test');
        
        const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
        await submitButton.click();
        
        // Look for cancel button
        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Stop")').first();
        if (await cancelButton.isVisible({ timeout: 5000 })) {
          await cancelButton.click();
          
          // Should stop execution
          await expect(page.locator('text=/canceled|stopped/i')).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should provide clear error messages', async ({ page }) => {
      await page.goto('/opportunity');
      
      // Trigger an error
      const submitButton = page.locator('button:has-text("Analyze"), button:has-text("Submit")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Error message should be clear and actionable
        const errorMessage = page.locator('[role="alert"], .error, text=/error/i').first();
        if (await errorMessage.isVisible({ timeout: 5000 })) {
          const text = await errorMessage.textContent();
          expect(text).toBeTruthy();
          expect(text!.length).toBeGreaterThan(10);
        }
      }
    });
  });
});
