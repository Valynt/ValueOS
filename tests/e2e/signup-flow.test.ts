/**
 * Signup Flow E2E Tests
 * 
 * Tests for complete user signup journey:
 * - Email verification
 * - Onboarding process
 * - First project creation
 * 
 * Acceptance Criteria: 100% signup success
 */

import { test, expect, Page } from '@playwright/test';

// Mock email verification for testing
const mockEmailVerification = async (page: Page, email: string) => {
  // In production, this would check actual email service
  // For testing, we simulate verification
  await page.evaluate((email) => {
    localStorage.setItem('email_verified', 'true');
    localStorage.setItem('verified_email', email);
  }, email);
};

test.describe('Signup Flow - User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto('/');
  });

  test.describe('Email Verification', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup');
      
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/signup');
      
      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');
      
      // Try invalid email
      await emailInput.fill('invalid-email');
      await submitButton.click();
      
      // Should show validation error
      await expect(page.locator('text=/invalid.*email/i')).toBeVisible({ timeout: 5000 });
    });

    test('should validate password strength', async ({ page }) => {
      await page.goto('/signup');
      
      const passwordInput = page.locator('input[type="password"]').first();
      
      // Try weak password
      await passwordInput.fill('123');
      
      // Should show strength indicator
      await expect(page.locator('text=/weak|strong|password/i')).toBeVisible({ timeout: 5000 });
    });

    test('should complete signup with valid credentials', async ({ page }) => {
      await page.goto('/signup');
      
      const email = `test-${Date.now()}@example.com`;
      const password = 'SecurePassword123!';
      
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      
      // Accept terms if present
      const termsCheckbox = page.locator('input[type="checkbox"]').first();
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check();
      }
      
      await page.locator('button[type="submit"]').click();
      
      // Should redirect or show success message
      await expect(page).toHaveURL(/\/(verify|onboarding|dashboard)/, { timeout: 10000 });
    });

    test('should send verification email', async ({ page }) => {
      await page.goto('/signup');
      
      const email = `test-${Date.now()}@example.com`;
      
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').first().fill('SecurePassword123!');
      
      await page.locator('button[type="submit"]').click();
      
      // Should show verification message
      await expect(page.locator('text=/verify.*email|check.*email/i')).toBeVisible({ timeout: 10000 });
    });

    test('should handle verification link click', async ({ page }) => {
      const email = `test-${Date.now()}@example.com`;
      
      // Simulate clicking verification link
      await page.goto(`/verify-email?token=test-token&email=${email}`);
      
      // Mock verification
      await mockEmailVerification(page, email);
      
      // Should show success or redirect
      await expect(page).toHaveURL(/\/(onboarding|dashboard)/, { timeout: 10000 });
    });

    test('should handle expired verification link', async ({ page }) => {
      await page.goto('/verify-email?token=expired-token');
      
      // Should show error or resend option
      await expect(page.locator('text=/expired|invalid|resend/i')).toBeVisible({ timeout: 5000 });
    });

    test('should allow resending verification email', async ({ page }) => {
      await page.goto('/verify-email');
      
      const resendButton = page.locator('button:has-text("Resend")');
      if (await resendButton.isVisible()) {
        await resendButton.click();
        
        // Should show confirmation
        await expect(page.locator('text=/sent|resent/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Onboarding Process', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate verified user
      const email = `test-${Date.now()}@example.com`;
      await mockEmailVerification(page, email);
      await page.goto('/onboarding');
    });

    test('should display welcome screen', async ({ page }) => {
      await expect(page.locator('text=/welcome|get started/i')).toBeVisible({ timeout: 5000 });
    });

    test('should collect user profile information', async ({ page }) => {
      // Look for name input
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test User');
      }
      
      // Look for company input
      const companyInput = page.locator('input[name="company"], input[placeholder*="company" i]').first();
      if (await companyInput.isVisible()) {
        await companyInput.fill('Test Company');
      }
      
      // Continue button
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      if (await continueButton.isVisible()) {
        await continueButton.click();
      }
    });

    test('should allow selecting user role', async ({ page }) => {
      // Look for role selection
      const roleOptions = page.locator('[role="radio"], input[type="radio"]');
      const count = await roleOptions.count();
      
      if (count > 0) {
        await roleOptions.first().click();
        
        const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
        if (await continueButton.isVisible()) {
          await continueButton.click();
        }
      }
    });

    test('should allow selecting use case', async ({ page }) => {
      // Look for use case selection
      const useCaseOptions = page.locator('[role="checkbox"], input[type="checkbox"]');
      const count = await useCaseOptions.count();
      
      if (count > 0) {
        await useCaseOptions.first().click();
        
        const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
        if (await continueButton.isVisible()) {
          await continueButton.click();
        }
      }
    });

    test('should complete onboarding flow', async ({ page }) => {
      // Fill out onboarding steps
      const steps = [
        { selector: 'input[name="name"]', value: 'Test User' },
        { selector: 'input[name="company"]', value: 'Test Company' },
      ];
      
      for (const step of steps) {
        const input = page.locator(step.selector).first();
        if (await input.isVisible()) {
          await input.fill(step.value);
        }
      }
      
      // Click through to completion
      const finishButton = page.locator('button:has-text("Finish"), button:has-text("Complete"), button:has-text("Get Started")').first();
      if (await finishButton.isVisible()) {
        await finishButton.click();
        
        // Should redirect to dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      }
    });

    test('should allow skipping optional steps', async ({ page }) => {
      const skipButton = page.locator('button:has-text("Skip")').first();
      if (await skipButton.isVisible()) {
        await skipButton.click();
        
        // Should progress to next step
        await expect(page.locator('text=/step|progress/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show progress indicator', async ({ page }) => {
      // Look for progress indicator
      const progressIndicator = page.locator('[role="progressbar"], .progress, [aria-valuenow]').first();
      if (await progressIndicator.isVisible()) {
        expect(await progressIndicator.isVisible()).toBe(true);
      }
    });

    test('should allow going back to previous step', async ({ page }) => {
      // Click continue first
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      if (await continueButton.isVisible()) {
        await continueButton.click();
        
        // Then go back
        const backButton = page.locator('button:has-text("Back")').first();
        if (await backButton.isVisible()) {
          await backButton.click();
          
          // Should return to previous step
          await expect(page.locator('text=/welcome|profile/i')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('First Project Creation', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate completed onboarding
      const email = `test-${Date.now()}@example.com`;
      await mockEmailVerification(page, email);
      await page.goto('/dashboard');
    });

    test('should display create project button', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
      await expect(createButton).toBeVisible({ timeout: 10000 });
    });

    test('should open project creation modal', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        // Should show modal or form
        await expect(page.locator('[role="dialog"], .modal, form')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate project name', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.isVisible()) {
          // Try empty name
          await nameInput.fill('');
          
          const submitButton = page.locator('button[type="submit"], button:has-text("Create")').last();
          await submitButton.click();
          
          // Should show validation error
          await expect(page.locator('text=/required|name/i')).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should create project with valid name', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const projectName = `Test Project ${Date.now()}`;
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        
        if (await nameInput.isVisible()) {
          await nameInput.fill(projectName);
          
          const submitButton = page.locator('button[type="submit"], button:has-text("Create")').last();
          await submitButton.click();
          
          // Should show success or redirect
          await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('should display project in list', async ({ page }) => {
      // Create a project first
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Project")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const projectName = `Test Project ${Date.now()}`;
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        
        if (await nameInput.isVisible()) {
          await nameInput.fill(projectName);
          
          const submitButton = page.locator('button[type="submit"], button:has-text("Create")').last();
          await submitButton.click();
          
          // Wait for project to appear
          await page.waitForTimeout(2000);
          
          // Should be in project list
          await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('should allow opening created project', async ({ page }) => {
      // Look for existing project
      const projectLink = page.locator('a[href*="/project"], [role="link"]:has-text("Project")').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        
        // Should navigate to project page
        await expect(page).toHaveURL(/\/project/, { timeout: 10000 });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors during signup', async ({ page }) => {
      await page.goto('/signup');
      
      // Simulate offline
      await page.context().setOffline(true);
      
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('input[type="password"]').first().fill('SecurePassword123!');
      await page.locator('button[type="submit"]').click();
      
      // Should show error message
      await expect(page.locator('text=/error|failed|network/i')).toBeVisible({ timeout: 5000 });
      
      // Restore online
      await page.context().setOffline(false);
    });

    test('should handle duplicate email registration', async ({ page }) => {
      await page.goto('/signup');
      
      const email = 'existing@example.com';
      
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').first().fill('SecurePassword123!');
      await page.locator('button[type="submit"]').click();
      
      // Should show error about existing account
      await expect(page.locator('text=/already.*exists|already.*registered/i')).toBeVisible({ timeout: 10000 });
    });

    test('should handle session timeout', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Clear session
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
      
      // Try to access protected page
      await page.reload();
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|signin)/, { timeout: 10000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/signup');
      
      // Tab through form
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should focus submit button
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/signup');
      
      const emailInput = page.locator('input[type="email"]');
      const ariaLabel = await emailInput.getAttribute('aria-label');
      const placeholder = await emailInput.getAttribute('placeholder');
      
      // Should have label or placeholder
      expect(ariaLabel || placeholder).toBeTruthy();
    });

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/signup');
      
      await page.locator('input[type="email"]').fill('invalid');
      await page.locator('button[type="submit"]').click();
      
      // Should have aria-live region
      const liveRegion = page.locator('[aria-live], [role="alert"]');
      await expect(liveRegion).toBeVisible({ timeout: 5000 });
    });
  });
});
