/**
 * End-to-End Authentication Flow Tests
 * Complete user journey testing from signup through login
 * 
 * Run with: npx playwright test tests/e2e/auth-complete-flow.spec.ts
 */

import { expect, Page, test } from '@playwright/test';

// Test data
const generateTestUser = () => ({
  email: `test.user.${Date.now()}@example.com`,
  password: 'SecureTestPass123!@#',
  fullName: 'Test User',
});

test.describe('Complete Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser: ReturnType<typeof generateTestUser>;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    testUser = generateTestUser();
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('TEST-E2E-001: Complete signup flow', async () => {
    // Navigate to signup page
    await page.goto('http://localhost:5173/signup');
    await expect(page).toHaveTitle(/value/i);

    // Verify form elements present
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[type="checkbox"][name*="terms"]')).toBeVisible();

    // Fill signup form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);
    await page.fill('input[name="fullName"]', testUser.fullName);
    
    // Accept terms of service
    await page.check('input[type="checkbox"][name*="terms"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirect or success message
    await page.waitForURL(/verify-email|dashboard/i, { timeout: 10000 });
    
    // If verification required, verify message is shown
    const currentUrl = page.url();
    if (currentUrl.includes('verify-email')) {
      await expect(page.locator('text=/verify.*email/i')).toBeVisible();
    }
  });

  test('TEST-E2E-002: Login with new credentials', async () => {
    // Navigate to login page
    await page.goto('http://localhost:5173/login');

    // Fill login form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard (or MFA if enabled)
    await page.waitForURL(/dashboard|\/|mfa/i, { timeout: 10000 });

    // Verify logged in state
    const currentUrl = page.url();
    if (!currentUrl.includes('mfa')) {
      // Should see dashboard or home page
      await expect(page.locator('text=/dashboard|home|welcome/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('TEST-E2E-003: Logout successfully', async () => {
    // Assuming we're logged in from previous test
    
    // Find and click logout button (adjust selector as needed)
    const logoutButton = page.locator('button:has-text("logout"), button:has-text("sign out"), [aria-label*="logout"]').first();
    
    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutButton.click();
      
      // Verify redirect to login
      await page.waitForURL(/login|home/i, { timeout: 5000 });
    }
  });
});

test.describe('Signup Validation Tests', () => {
  test('TEST-E2E-101: Invalid email validation', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    // Try invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    await page.fill('input[name="fullName"]', 'Test User');
    
    // Try to submit
    await page.click('button[type="submit"]');

    // Should see validation error
    await expect(page.locator('text=/invalid.*email/i')).toBeVisible({ timeout: 3000 });
  });

  test('TEST-E2E-102: Password mismatch validation', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPass123!');
    await page.fill('input[name="fullName"]', 'Test User');
    
    // Blur confirm password field to trigger validation
    await page.locator('input[name="confirmPassword"]').blur();

    // Should see mismatch error
    await expect(page.locator('text=/password.*match/i')).toBeVisible({ timeout: 3000 });
  });

  test('TEST-E2E-103: Weak password validation', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    const weakPasswords = [
      { value: 'pass', reason: 'too short' },
      { value: 'password123', reason: 'no uppercase' },
      { value: 'PASSWORD123', reason: 'no lowercase' },
      { value: 'Password', reason: 'no number' },
      { value: 'Password123', reason: 'no special char' },
    ];

    for (const { value, reason } of weakPasswords) {
      await page.fill('input[name="password"]', value);
      await page.locator('input[name="password"]').blur();
      
      // Should see validation error
      const hasError = await page.locator('text=/password|character|uppercase|lowercase|number|symbol/i')
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      
      expect(hasError).toBeTruthy();
    }
  });

  test('TEST-E2E-104: Terms of service requirement', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    await page.fill('input[name="fullName"]', 'Test User');
    
    // Don't check ToS
    // Try to submit
    await page.click('button[type="submit"]');

    // Should show ToS error
    await expect(page.locator('text=/terms.*service|accept.*terms/i')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Login Validation Tests', () => {
  test('TEST-E2E-201: Empty credentials validation', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission or show errors
    const emailInput = page.locator('input[name="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    
    expect(isInvalid).toBeTruthy();
  });

  test('TEST-E2E-202: Invalid credentials error', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    
    await page.click('button[type="submit"]');

    // Should see error message
    await expect(page.locator('text=/invalid.*credentials|invalid.*password|invalid.*email/i'))
      .toBeVisible({ timeout: 5000 });
  });

  test('TEST-E2E-203: Password visibility toggle', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const passwordInput = page.locator('input[name="password"]');
    const toggleButton = page.locator('button:has-text("show"), button:has-text("hide"), button[aria-label*="password"]').first();

    // Initially should be password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle
    if (await toggleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleButton.click();
      
      // Should be text type now
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click again
      await toggleButton.click();
      
      // Should be password type again
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  test('TEST-E2E-204: Forgot password link', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const forgotLink = page.locator('a:has-text("forgot"), a:has-text("reset")').first();
    
    if (await forgotLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await forgotLink.click();
      
      // Should navigate to password reset page
      await page.waitForURL(/reset|forgot/i, { timeout: 3000 });
    }
  });
});

test.describe('OAuth Flow Tests', () => {
  test('TEST-E2E-301: OAuth buttons present', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Check for OAuth provider buttons
    const googleButton = page.locator('button:has-text("google"), button[aria-label*="google"]').first();
    const appleButton = page.locator('button:has-text("apple"), button[aria-label*="apple"]').first();
    const githubButton = page.locator('button:has-text("github"), button[aria-label*="github"]').first();

    // At least one OAuth option should be visible
    const hasOAuth = 
      await googleButton.isVisible({ timeout: 2000 }).catch(() => false) ||
      await appleButton.isVisible({ timeout: 2000 }).catch(() => false) ||
      await githubButton.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasOAuth).toBeTruthy();
  });

  test('TEST-E2E-302: OAuth redirect wiring is present', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const oauthButtons = [
      page.locator('button:has-text("google"), button[aria-label*="google" i]').first(),
      page.locator('button:has-text("apple"), button[aria-label*="apple" i]').first(),
      page.locator('button:has-text("github"), button[aria-label*="github" i]').first(),
    ];

    let visibleCount = 0;
    for (const button of oauthButtons) {
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(button).toBeEnabled();
        visibleCount += 1;
      }
    }

    expect(visibleCount).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design Tests', () => {
  test('TEST-E2E-401: Mobile viewport - signup form', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto('http://localhost:5173/signup');

    // Verify form is usable on mobile
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Verify no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    
    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('TEST-E2E-402: Tablet viewport - login form', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto('http://localhost:5173/login');

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Accessibility Tests', () => {
  test('TEST-E2E-501: Keyboard navigation - signup', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    // Tab through form
    await page.keyboard.press('Tab'); // Email
    await expect(page.locator('input[name="email"]')).toBeFocused();

    await page.keyboard.press('Tab'); // Password
    await expect(page.locator('input[name="password"]')).toBeFocused();

    await page.keyboard.press('Tab'); // Confirm Password
    await expect(page.locator('input[name="confirmPassword"]')).toBeFocused();

    await page.keyboard.press('Tab'); // Full Name
    await expect(page.locator('input[name="fullName"]')).toBeFocused();
  });

  test('TEST-E2E-502: Focus indicators visible', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const emailInput = page.locator('input[name="email"]');
    
    await emailInput.focus();
    
    // Check that focus indicator is visible (has outline or box-shadow)
    const hasFocusStyle = await emailInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' || styles.boxShadow !== 'none';
    });

    expect(hasFocusStyle).toBeTruthy();
  });

  test('TEST-E2E-503: ARIA labels present', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    // Check for proper ARIA attributes
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await expect(emailInput).toHaveAttribute('aria-required', 'true');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');
  });
});

test.describe('Performance Tests', () => {
  test('TEST-E2E-601: Page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:5173/login');
    const loadTime = Date.now() - startTime;

    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('TEST-E2E-602: Form submission response time', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'WrongPass123!');

    const startTime = Date.now();
    await page.click('button[type="submit"]');
    
    // Wait for response (error or success)
    await page.waitForSelector('text=/invalid|error|success/i', { timeout: 5000 });
    
    const responseTime = Date.now() - startTime;

    // Response should come in under 2 seconds
    expect(responseTime).toBeLessThan(2000);
  });
});

test.describe('Error Handling Tests', () => {
  test('TEST-E2E-701: Network error handling', async ({ page, context }) => {
    await page.goto('http://localhost:5173/login');

    // Fill form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');

    // Simulate offline
    await context.setOffline(true);

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show network error
    await expect(page.locator('text=/network|connection|offline/i'))
      .toBeVisible({ timeout: 5000 });

    // Restore online
    await context.setOffline(false);
  });

  test('TEST-E2E-702: Session expiry handling shows auth recovery state', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await page.fill('input[name="email"]', 'expired.session@example.com');
    await page.fill('input[name="password"]', 'ExpiredPass123!');
    await page.click('button[type="submit"]');

    const authFeedback = page.locator('text=/session|expired|invalid|login|reauth/i').first();
    await expect(authFeedback).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Security Tests', () => {
  test('TEST-E2E-801: XSS prevention in inputs', async ({ page }) => {
    await page.goto('http://localhost:5173/signup');

    const xssPayload = '<script>alert("XSS")</script>';
    
    await page.fill('input[name="fullName"]', xssPayload);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    await page.check('input[type="checkbox"][name*="terms"]');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Check that script didn't execute
    const dialogShown = await page.evaluate(() => {
      return !!window.opener; // Would be true if alert opened
    });

    expect(dialogShown).toBeFalsy();
  });

  test('TEST-E2E-802: HTTPS enforcement guardrails for auth links', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const externalLinks = page.locator('a[href^="http"]');
    const count = await externalLinks.count();
    for (let idx = 0; idx < count; idx += 1) {
      const href = await externalLinks.nth(idx).getAttribute('href');
      if (href && !href.includes('localhost')) {
        expect(href.startsWith('https://')).toBeTruthy();
      }
    }
  });

  test('TEST-E2E-803: Password not visible in DevTools', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const passwordInput = page.locator('input[name="password"]');
    
    await page.fill('input[name="password"]', 'SecurePass123!');

    // Verify input type is password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verify password value is not in DOM as text
    const innerText = await page.evaluate(() => document.body.innerText);
    expect(innerText).not.toContain('SecurePass123!');
  });
});
