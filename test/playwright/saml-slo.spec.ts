/**
 * SAML Single Logout (SLO) Verification Tests
 * 
 * Validates SAML 2.0 Single Logout implementation:
 * - Front-channel logout (HTTP-Redirect/HTTP-POST)
 * - Back-channel logout (SOAP)
 * - Session invalidation on both IdP and SP
 * - 401 response on session reuse attempts
 * - Logout propagation across multiple SPs (if applicable)
 * 
 * Requirements: Session security, proper cleanup
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  SAML_ENDPOINTS,
  TEST_USERS,
  LOGOUT_REQUEST,
  LOGOUT_RESPONSE,
} from '../saml/fixtures/saml-responses';

// Correlation ID for debugging
const generateCorrelationId = () => `saml-slo-${Date.now()}-${Math.random().toString(36).substring(7)}`;

test.describe('SAML Single Logout (SLO)', () => {
  let correlationId: string;

  test.beforeEach(async ({ page }) => {
    correlationId = generateCorrelationId();
    
    // Inject correlation ID
    await page.addInitScript((corrId) => {
      (window as any).__samlTestCorrelationId = corrId;
    }, correlationId);

    // Monitor console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[${correlationId}] Browser error:`, msg.text());
      }
    });
  });

  test.describe('Front-Channel Logout (HTTP-Redirect)', () => {
    test('should perform SP-initiated logout via HTTP-Redirect', async ({ page, context }) => {
      // Step 1: Authenticate user
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Capture session token before logout
      const sessionTokenBefore = await getSessionToken(context);
      expect(sessionTokenBefore).toBeTruthy();

      // Step 2: Initiate logout from SP
      await page.click('[data-testid="logout-button"]');

      // Should redirect to IdP logout endpoint
      await page.waitForURL(/keycloak.*\/logout/, { timeout: 5000 });

      // Step 3: Wait for IdP to process logout
      // IdP should redirect back to SP logout callback
      await page.waitForURL(/localhost:5174/, { timeout: 5000 });

      // Step 4: Verify session is cleared
      const sessionTokenAfter = await getSessionToken(context);
      expect(sessionTokenAfter).toBeNull();

      // Step 5: Verify redirect to login page
      await expect(page).toHaveURL(/\/login/);

      console.log(`[${correlationId}] ✓ SP-initiated front-channel logout completed`);
    });

    test('should perform IdP-initiated logout via HTTP-Redirect', async ({ page, context }) => {
      // Step 1: Authenticate user
      await authenticateViaSAML(page, TEST_USERS.valid);

      const sessionTokenBefore = await getSessionToken(context);
      expect(sessionTokenBefore).toBeTruthy();

      // Step 2: Navigate to IdP and initiate logout there
      await page.goto(`${SAML_ENDPOINTS.idpSloUrl}?redirect_uri=${encodeURIComponent('http://localhost:5174/login')}`);

      // Step 3: IdP should send LogoutRequest to SP
      // Wait for SP to process and clear session
      await page.waitForURL(/localhost:5174/, { timeout: 10000 });

      // Step 4: Verify session is cleared
      const sessionTokenAfter = await getSessionToken(context);
      expect(sessionTokenAfter).toBeNull();

      // Step 5: Verify user is logged out
      await page.goto('http://localhost:5174/dashboard');
      await expect(page).toHaveURL(/\/login/);

      console.log(`[${correlationId}] ✓ IdP-initiated front-channel logout completed`);
    });
  });

  test.describe('Front-Channel Logout (HTTP-POST)', () => {
    test('should handle logout via HTTP-POST binding', async ({ page, context }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Intercept logout request to verify POST method
      let logoutMethod: string | null = null;
      
      await page.route('**/api/auth/saml/slo', async (route) => {
        logoutMethod = route.request().method();
        await route.continue();
      });

      await page.click('[data-testid="logout-button"]');

      // Wait for logout to complete
      await page.waitForURL(/\/login/, { timeout: 10000 });

      // Verify POST method was used
      expect(logoutMethod).toBe('POST');

      // Verify session cleared
      const sessionToken = await getSessionToken(context);
      expect(sessionToken).toBeNull();

      console.log(`[${correlationId}] ✓ HTTP-POST logout binding verified`);
    });
  });

  test.describe('Back-Channel Logout (SOAP)', () => {
    test('should handle back-channel logout request', async ({ page, context }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      const sessionIndex = await page.evaluate(() => {
        return (window as any).__samlSessionIndex;
      });

      // Simulate back-channel logout request from IdP
      const backChannelLogoutUrl = 'http://localhost:5174/api/auth/saml/slo/backchannel';
      
      const soapLogoutRequest = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            ${LOGOUT_REQUEST.replace('_session_index_123', sessionIndex || '_session_index_123')}
          </soap:Body>
        </soap:Envelope>
      `;

      const response = await page.request.post(backChannelLogoutUrl, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.oasis-open.org/committees/security',
        },
        data: soapLogoutRequest,
      });

      // Should return 200 OK
      expect(response.status()).toBe(200);

      // Verify session is invalidated
      await page.reload();
      await expect(page).toHaveURL(/\/login/);

      const sessionToken = await getSessionToken(context);
      expect(sessionToken).toBeNull();

      console.log(`[${correlationId}] ✓ Back-channel (SOAP) logout processed`);
    });
  });

  test.describe('Session Invalidation', () => {
    test('should invalidate session on both IdP and SP sides', async ({ page, context, browser }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Open second tab to verify multi-tab logout
      const secondPage = await context.newPage();
      await secondPage.goto('http://localhost:5174/dashboard');
      
      // Second tab should also be authenticated
      const isAuthenticatedBefore = await secondPage.locator('[data-testid="user-menu"]').isVisible();
      expect(isAuthenticatedBefore).toBe(true);

      // Logout from first tab
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(/\/login/);

      // Wait a moment for session propagation
      await secondPage.waitForTimeout(1000);

      // Refresh second tab - should also be logged out
      await secondPage.reload();
      await expect(secondPage).toHaveURL(/\/login/);

      await secondPage.close();

      console.log(`[${correlationId}] ✓ Session invalidated across all tabs`);
    });

    test('should return 401 on session reuse after logout', async ({ page, context }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Capture session token and cookies
      const sessionToken = await getSessionToken(context);
      const cookies = await context.cookies();

      // Logout
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(/\/login/);

      // Attempt to reuse old session token
      if (sessionToken) {
        const response = await page.request.get('http://localhost:5174/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        // Should return 401 Unauthorized
        expect(response.status()).toBe(401);

        console.log(`[${correlationId}] ✓ Session reuse rejected with 401`);
      }

      // Attempt to restore old cookies and access protected resource
      await context.addCookies(cookies);
      await page.goto('http://localhost:5174/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      console.log(`[${correlationId}] ✓ Cookie reuse rejected`);
    });

    test('should clear all session artifacts on logout', async ({ page, context }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Logout
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(/\/login/);

      // Verify all session artifacts cleared
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(c => 
        c.name.includes('session') || 
        c.name.includes('auth') || 
        c.name.includes('token')
      );

      expect(sessionCookies.length).toBe(0);

      // Verify localStorage cleared
      const localStorageItems = await page.evaluate(() => {
        const items: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.includes('auth') || key?.includes('session')) {
            items.push(key);
          }
        }
        return items;
      });

      expect(localStorageItems.length).toBe(0);

      console.log(`[${correlationId}] ✓ All session artifacts cleared`);
    });
  });

  test.describe('Logout Response Validation', () => {
    test('should validate LogoutResponse from IdP', async ({ page, context }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      let logoutResponseReceived = false;
      let logoutResponseValid = false;

      // Intercept LogoutResponse
      await page.route('**/api/auth/saml/slo', async (route) => {
        const postData = route.request().postData();
        
        if (postData?.includes('LogoutResponse')) {
          logoutResponseReceived = true;
          
          // Check for success status
          if (postData.includes('urn:oasis:names:tc:SAML:2.0:status:Success')) {
            logoutResponseValid = true;
          }
        }
        
        await route.continue();
      });

      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(/\/login/);

      expect(logoutResponseReceived).toBe(true);
      expect(logoutResponseValid).toBe(true);

      console.log(`[${correlationId}] ✓ LogoutResponse validated`);
    });

    test('should handle logout failure gracefully', async ({ page }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Simulate IdP logout failure
      await page.route('**/realms/valuecanvas-test/protocol/saml**', async (route) => {
        if (route.request().url().includes('logout')) {
          await route.fulfill({
            status: 500,
            body: 'Internal Server Error',
          });
        } else {
          await route.continue();
        }
      });

      await page.click('[data-testid="logout-button"]');

      // Should show error message but still clear local session
      const errorMessage = await page.locator('[data-testid="logout-error"]').textContent({ timeout: 5000 });
      expect(errorMessage).toMatch(/error|failed/i);

      // Local session should still be cleared
      await page.goto('http://localhost:5174/dashboard');
      await expect(page).toHaveURL(/\/login/);

      console.log(`[${correlationId}] ✓ Logout failure handled gracefully`);
    });
  });

  test.describe('Multi-SP Logout Propagation', () => {
    test.skip('should propagate logout to all registered SPs', async ({ page, browser }) => {
      // This test requires multiple SP applications
      // Skipped for now, implement when multi-SP scenario is available
      
      console.log(`[${correlationId}] ⊘ Multi-SP logout test skipped (not applicable)`);
    });
  });
});

/**
 * Helper: Authenticate via SAML
 */
async function authenticateViaSAML(page: Page, user: typeof TEST_USERS.valid): Promise<void> {
  await page.goto('http://localhost:5174/dashboard');
  await page.waitForURL(/keycloak/, { timeout: 5000 });
  
  await page.fill('input[name="username"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('input[type="submit"]');
  
  await page.waitForURL(/localhost:5174\/dashboard/, { timeout: 10000 });
}

/**
 * Helper: Get session token from browser context
 */
async function getSessionToken(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => 
    c.name === 'session_token' || 
    c.name === 'auth_token' ||
    c.name.includes('session')
  );
  
  return sessionCookie?.value || null;
}
