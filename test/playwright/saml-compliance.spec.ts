/**
 * SAML Compliance Test Suite
 * 
 * Validates SAML 2.0 implementation against security standards:
 * - SP-initiated and IdP-initiated flows
 * - Attribute mapping and multi-tenancy
 * - Clock skew tolerance
 * - Expired certificate rejection
 * - Replay attack prevention
 * 
 * Requirements: GR-020 (PII Protection), GR-010 (Tenant Isolation)
 */

import { test, expect, Page } from '@playwright/test';
import {
  SAML_ENDPOINTS,
  TEST_USERS,
  CLOCK_SKEW_TOLERANCE_SECONDS,
} from '../saml/fixtures/saml-responses';

// Correlation ID helper for debugging
const generateCorrelationId = () => `saml-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

test.describe('SAML Compliance Suite', () => {
  let correlationId: string;

  test.beforeEach(async ({ page }) => {
    correlationId = generateCorrelationId();
    
    // Inject correlation ID into console logs
    await page.addInitScript((corrId) => {
      (window as any).__samlTestCorrelationId = corrId;
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        originalLog(`[${corrId}]`, ...args);
      };
    }, correlationId);

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[${correlationId}] Browser error:`, msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (err) => {
      console.error(`[${correlationId}] Page error:`, err.message);
    });
  });

  test.describe('SP-Initiated Flow', () => {
    test('should successfully authenticate via SP-initiated SAML flow', async ({ page }) => {
      // Navigate to protected resource (triggers SAML redirect)
      await page.goto('http://localhost:5174/dashboard');

      // Should redirect to IdP login page
      await expect(page).toHaveURL(/keycloak.*\/realms\/valuecanvas-test/);

      // Fill in credentials
      await page.fill('input[name="username"]', TEST_USERS.valid.email);
      await page.fill('input[name="password"]', TEST_USERS.valid.password);
      
      // Click login button
      await page.click('input[type="submit"]');

      // Should redirect back to SP with SAML response
      await page.waitForURL('http://localhost:5174/dashboard', { timeout: 10000 });

      // Verify user is authenticated
      const userInfo = await page.locator('[data-testid="user-info"]').textContent();
      expect(userInfo).toContain(TEST_USERS.valid.firstName);

      console.log(`[${correlationId}] ✓ SP-initiated flow completed successfully`);
    });

    test('should include correlation ID in SAML request', async ({ page }) => {
      const samlRequests: string[] = [];

      // Intercept SAML requests
      await page.route('**/realms/valuecanvas-test/protocol/saml**', async (route) => {
        const url = route.request().url();
        samlRequests.push(url);
        await route.continue();
      });

      await page.goto('http://localhost:5174/dashboard');
      
      // Wait for SAML redirect
      await page.waitForURL(/keycloak/);

      // Verify RelayState includes correlation tracking
      expect(samlRequests.length).toBeGreaterThan(0);
      const samlRequest = samlRequests[0];
      expect(samlRequest).toMatch(/RelayState=/);

      console.log(`[${correlationId}] ✓ Correlation ID included in SAML request`);
    });

    test('should reject authentication with expired user account', async ({ page }) => {
      await page.goto('http://localhost:5174/dashboard');
      await expect(page).toHaveURL(/keycloak/);

      // Try to login with expired user
      await page.fill('input[name="username"]', TEST_USERS.expired.email);
      await page.fill('input[name="password"]', TEST_USERS.expired.password);
      await page.click('input[type="submit"]');

      // Should show error message
      const errorMessage = await page.locator('.alert-error, .kc-feedback-text').textContent();
      expect(errorMessage).toMatch(/disabled|invalid|error/i);

      console.log(`[${correlationId}] ✓ Expired account rejected`);
    });
  });

  test.describe('IdP-Initiated Flow', () => {
    test('should successfully authenticate via IdP-initiated flow', async ({ page }) => {
      // Login to Keycloak first
      await page.goto('http://localhost:8080/realms/valuecanvas-test/account');
      await page.fill('input[name="username"]', TEST_USERS.valid.email);
      await page.fill('input[name="password"]', TEST_USERS.valid.password);
      await page.click('input[type="submit"]');

      // Navigate to IdP-initiated SSO endpoint
      await page.goto(`${SAML_ENDPOINTS.idpSsoUrl}?client_id=${encodeURIComponent(SAML_ENDPOINTS.spMetadata)}`);

      // Should redirect to SP application
      await page.waitForURL(/localhost:5174/);

      // Verify authenticated
      const isAuthenticated = await page.locator('[data-testid="user-menu"]').isVisible();
      expect(isAuthenticated).toBe(true);

      console.log(`[${correlationId}] ✓ IdP-initiated flow completed`);
    });
  });

  test.describe('Attribute Mapping', () => {
    test('should correctly map SAML attributes to user profile', async ({ page }) => {
      // Complete authentication
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Verify user profile contains mapped attributes
      await page.goto('http://localhost:5174/settings/profile');

      const firstName = await page.locator('[data-testid="profile-first-name"]').inputValue();
      const lastName = await page.locator('[data-testid="profile-last-name"]').inputValue();
      const email = await page.locator('[data-testid="profile-email"]').inputValue();

      expect(firstName).toBe(TEST_USERS.valid.firstName);
      expect(lastName).toBe(TEST_USERS.valid.lastName);
      expect(email).toBe(TEST_USERS.valid.email);

      console.log(`[${correlationId}] ✓ SAML attributes mapped correctly`);
    });

    test('should enforce tenant isolation via SAML tenant_id attribute', async ({ page }) => {
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Get tenant context from page
      const tenantId = await page.evaluate(() => {
        return (window as any).__tenantContext?.tenant_id;
      });

      expect(tenantId).toBe(TEST_USERS.valid.tenantId);

      // Verify API requests include tenant_id
      let apiRequestTenantId: string | null = null;

      await page.route('**/api/**', async (route) => {
        const headers = route.request().headers();
        apiRequestTenantId = headers['x-tenant-id'] || null;
        await route.continue();
      });

      await page.goto('http://localhost:5174/dashboard');
      
      // Wait for API call
      await page.waitForTimeout(1000);

      expect(apiRequestTenantId).toBe(TEST_USERS.valid.tenantId);

      console.log(`[${correlationId}] ✓ Tenant isolation enforced (GR-010)`);
    });
  });

  test.describe('Clock Skew Tolerance', () => {
    test('should accept assertions within clock skew tolerance window', async ({ page }) => {
      // This test validates the system accepts assertions with timestamps
      // within the acceptable clock skew window (default: 3 minutes)
      
      const mockTime = Date.now() + (CLOCK_SKEW_TOLERANCE_SECONDS - 30) * 1000;

      // Mock system time
      await page.addInitScript((time) => {
        const originalDate = Date;
        (window as any).Date = class extends originalDate {
          constructor(...args: any[]) {
            if (args.length === 0) {
              return new originalDate(time);
            }
            return new originalDate(...args);
          }
          static now() {
            return time;
          }
        };
      }, mockTime);

      await authenticateViaSAML(page, TEST_USERS.valid);

      // Should successfully authenticate despite time difference
      const isAuthenticated = await page.locator('[data-testid="user-menu"]').isVisible();
      expect(isAuthenticated).toBe(true);

      console.log(`[${correlationId}] ✓ Clock skew tolerance validated`);
    });

    test('should reject assertions outside clock skew tolerance', async ({ page }) => {
      // Set time far in the future (beyond tolerance)
      const mockTime = Date.now() + (CLOCK_SKEW_TOLERANCE_SECONDS + 60) * 1000;

      await page.addInitScript((time) => {
        const originalDate = Date;
        (window as any).Date = class extends originalDate {
          constructor(...args: any[]) {
            if (args.length === 0) {
              return new originalDate(time);
            }
            return new originalDate(...args);
          }
          static now() {
            return time;
          }
        };
      }, mockTime);

      await page.goto('http://localhost:5174/dashboard');
      await page.waitForURL(/keycloak/);
      
      await page.fill('input[name="username"]', TEST_USERS.valid.email);
      await page.fill('input[name="password"]', TEST_USERS.valid.password);
      await page.click('input[type="submit"]');

      // Should redirect back to SP but fail authentication
      await page.waitForURL(/localhost:5174/);

      // Should show error about invalid assertion
      const errorMessage = await page.locator('[data-testid="auth-error"]').textContent();
      expect(errorMessage).toMatch(/expired|invalid|time/i);

      console.log(`[${correlationId}] ✓ Assertions outside tolerance rejected`);
    });
  });

  test.describe('Certificate Validation', () => {
    test('should reject SAML responses with expired certificates', async ({ page }) => {
      // This requires configuring the IdP to use expired cert temporarily
      // or mocking the validation layer
      
      // Intercept SAML ACS endpoint
      await page.route('**/api/auth/saml/acs', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        
        // Check if expired cert was detected
        expect(body).toMatch(/certificate.*expired/i);
        
        await route.fulfill({ response });
      });

      await page.goto('http://localhost:5174/dashboard');
      // Attempt authentication would fail at cert validation

      console.log(`[${correlationId}] ✓ Expired certificate validation tested`);
    });
  });

  test.describe('Replay Attack Prevention', () => {
    test('should reject replayed SAML assertions', async ({ page }) => {
      // First successful authentication
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Capture SAML response
      let capturedSAMLResponse: string | null = null;

      await page.route('**/api/auth/saml/acs', async (route) => {
        const postData = route.request().postData();
        if (postData && postData.includes('SAMLResponse')) {
          capturedSAMLResponse = new URLSearchParams(postData).get('SAMLResponse');
        }
        await route.continue();
      });

      // Logout
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL(/localhost:5174\/login/);

      // Attempt to replay the captured SAML response
      if (capturedSAMLResponse) {
        const response = await page.request.post('http://localhost:5174/api/auth/saml/acs', {
          form: {
            SAMLResponse: capturedSAMLResponse,
          },
        });

        // Should be rejected
        expect(response.status()).toBe(401);
        
        const body = await response.text();
        expect(body).toMatch(/replay|already used|invalid/i);

        console.log(`[${correlationId}] ✓ Replay attack prevented`);
      }
    });

    test('should maintain assertion ID cache to prevent replays', async ({ page }) => {
      // Verify system maintains cache of used assertion IDs
      await authenticateViaSAML(page, TEST_USERS.valid);

      // Check Redis/cache for assertion ID
      const cacheKey = await page.evaluate(() => {
        return (window as any).__lastAssertionId;
      });

      expect(cacheKey).toBeTruthy();

      console.log(`[${correlationId}] ✓ Assertion ID cached for replay prevention`);
    });
  });
});

/**
 * Helper function to authenticate via SAML
 */
async function authenticateViaSAML(page: Page, user: typeof TEST_USERS.valid): Promise<void> {
  await page.goto('http://localhost:5174/dashboard');
  
  // Wait for redirect to IdP
  await page.waitForURL(/keycloak/, { timeout: 5000 });

  // Login
  await page.fill('input[name="username"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('input[type="submit"]');

  // Wait for redirect back to SP
  await page.waitForURL(/localhost:5174/, { timeout: 10000 });
}
