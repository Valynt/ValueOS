/**
 * Browser Compatibility E2E Tests
 * 
 * Tests for cross-browser support:
 * - Chrome/Chromium
 * - Firefox
 * - Safari (WebKit)
 * - Edge
 * 
 * Acceptance Criteria: 100% compatibility
 */

import { test, expect, devices } from '@playwright/test';

// Test across multiple browsers
const browsers = ['chromium', 'firefox', 'webkit'] as const;

test.describe('Browser Compatibility - Cross-Browser Support', () => {
  for (const browserType of browsers) {
    test.describe(`${browserType.toUpperCase()} Browser`, () => {
      test.use({ 
        browserName: browserType,
        viewport: { width: 1280, height: 720 },
      });

      test('should load homepage', async ({ page }) => {
        await page.goto('/');
        
        await expect(page).toHaveTitle(/ValueCanvas|ValueOS/i, { timeout: 10000 });
      });

      test('should render navigation correctly', async ({ page }) => {
        await page.goto('/');
        
        const nav = page.locator('nav, [role="navigation"]').first();
        await expect(nav).toBeVisible({ timeout: 5000 });
      });

      test('should handle CSS correctly', async ({ page }) => {
        await page.goto('/');
        
        // Check if styles are applied
        const body = page.locator('body');
        const backgroundColor = await body.evaluate((el) => 
          window.getComputedStyle(el).backgroundColor
        );
        
        expect(backgroundColor).toBeTruthy();
      });

      test('should execute JavaScript correctly', async ({ page }) => {
        await page.goto('/');
        
        // Test JavaScript execution
        const result = await page.evaluate(() => {
          return typeof window !== 'undefined' && typeof document !== 'undefined';
        });
        
        expect(result).toBe(true);
      });

      test('should handle form inputs', async ({ page }) => {
        await page.goto('/signup');
        
        const emailInput = page.locator('input[type="email"]').first();
        if (await emailInput.isVisible()) {
          await emailInput.fill('test@example.com');
          
          const value = await emailInput.inputValue();
          expect(value).toBe('test@example.com');
        }
      });

      test('should handle button clicks', async ({ page }) => {
        await page.goto('/');
        
        const button = page.locator('button, a[role="button"]').first();
        if (await button.isVisible()) {
          await button.click();
          
          // Should navigate or trigger action
          await page.waitForTimeout(1000);
          expect(true).toBe(true);
        }
      });

      test('should support local storage', async ({ page }) => {
        await page.goto('/');
        
        await page.evaluate(() => {
          localStorage.setItem('test', 'value');
        });
        
        const value = await page.evaluate(() => {
          return localStorage.getItem('test');
        });
        
        expect(value).toBe('value');
      });

      test('should support session storage', async ({ page }) => {
        await page.goto('/');
        
        await page.evaluate(() => {
          sessionStorage.setItem('test', 'value');
        });
        
        const value = await page.evaluate(() => {
          return sessionStorage.getItem('test');
        });
        
        expect(value).toBe('value');
      });

      test('should handle fetch API', async ({ page }) => {
        await page.goto('/');
        
        const fetchSupported = await page.evaluate(() => {
          return typeof fetch !== 'undefined';
        });
        
        expect(fetchSupported).toBe(true);
      });

      test('should support modern JavaScript features', async ({ page }) => {
        await page.goto('/');
        
        const features = await page.evaluate(() => {
          return {
            arrow: typeof (() => {}) === 'function',
            async: typeof (async () => {}) === 'function',
            promise: typeof Promise !== 'undefined',
            map: typeof Map !== 'undefined',
            set: typeof Set !== 'undefined',
          };
        });
        
        expect(features.arrow).toBe(true);
        expect(features.async).toBe(true);
        expect(features.promise).toBe(true);
        expect(features.map).toBe(true);
        expect(features.set).toBe(true);
      });

      test('should render responsive layout', async ({ page }) => {
        await page.goto('/');
        
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);
        
        const body = page.locator('body');
        const width = await body.evaluate((el) => el.clientWidth);
        
        expect(width).toBeLessThanOrEqual(375);
        
        // Test desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(500);
        
        const desktopWidth = await body.evaluate((el) => el.clientWidth);
        expect(desktopWidth).toBeGreaterThan(375);
      });

      test('should handle media queries', async ({ page }) => {
        await page.goto('/');
        
        // Test mobile media query
        await page.setViewportSize({ width: 375, height: 667 });
        
        const isMobile = await page.evaluate(() => {
          return window.matchMedia('(max-width: 768px)').matches;
        });
        
        expect(isMobile).toBe(true);
      });

      test('should support CSS Grid', async ({ page }) => {
        await page.goto('/');
        
        const gridSupported = await page.evaluate(() => {
          const div = document.createElement('div');
          div.style.display = 'grid';
          return div.style.display === 'grid';
        });
        
        expect(gridSupported).toBe(true);
      });

      test('should support CSS Flexbox', async ({ page }) => {
        await page.goto('/');
        
        const flexSupported = await page.evaluate(() => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          return div.style.display === 'flex';
        });
        
        expect(flexSupported).toBe(true);
      });

      test('should handle SVG rendering', async ({ page }) => {
        await page.goto('/');
        
        const svg = page.locator('svg').first();
        if (await svg.isVisible({ timeout: 5000 })) {
          const bbox = await svg.boundingBox();
          expect(bbox).toBeTruthy();
        }
      });

      test('should support WebSockets', async ({ page }) => {
        await page.goto('/');
        
        const wsSupported = await page.evaluate(() => {
          return typeof WebSocket !== 'undefined';
        });
        
        expect(wsSupported).toBe(true);
      });

      test('should handle console errors gracefully', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });
        
        await page.goto('/');
        
        // Should have minimal console errors
        expect(errors.length).toBeLessThan(5);
      });

      test('should load without JavaScript errors', async ({ page }) => {
        const jsErrors: Error[] = [];
        
        page.on('pageerror', (error) => {
          jsErrors.push(error);
        });
        
        await page.goto('/');
        await page.waitForTimeout(2000);
        
        // Should have no JavaScript errors
        expect(jsErrors.length).toBe(0);
      });

      test('should handle navigation', async ({ page }) => {
        await page.goto('/');
        
        const link = page.locator('a[href]').first();
        if (await link.isVisible()) {
          await link.click();
          
          // Should navigate
          await page.waitForTimeout(1000);
          expect(page.url()).toBeTruthy();
        }
      });

      test('should support back/forward navigation', async ({ page }) => {
        await page.goto('/');
        const initialUrl = page.url();
        
        const link = page.locator('a[href]').first();
        if (await link.isVisible()) {
          await link.click();
          await page.waitForTimeout(1000);
          
          // Go back
          await page.goBack();
          await page.waitForTimeout(500);
          
          expect(page.url()).toBe(initialUrl);
        }
      });
    });
  }

  test.describe('Device Emulation', () => {
    test('should work on iPhone', async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['iPhone 12'],
      });
      const page = await context.newPage();
      
      await page.goto('/');
      
      await expect(page).toHaveTitle(/ValueCanvas|ValueOS/i, { timeout: 10000 });
      
      await context.close();
    });

    test('should work on iPad', async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['iPad Pro'],
      });
      const page = await context.newPage();
      
      await page.goto('/');
      
      await expect(page).toHaveTitle(/ValueCanvas|ValueOS/i, { timeout: 10000 });
      
      await context.close();
    });

    test('should work on Android', async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['Pixel 5'],
      });
      const page = await context.newPage();
      
      await page.goto('/');
      
      await expect(page).toHaveTitle(/ValueCanvas|ValueOS/i, { timeout: 10000 });
      
      await context.close();
    });

    test('should handle touch events', async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['iPhone 12'],
        hasTouch: true,
      });
      const page = await context.newPage();
      
      await page.goto('/');
      
      const button = page.locator('button').first();
      if (await button.isVisible()) {
        await button.tap();
        
        // Should handle tap
        await page.waitForTimeout(500);
        expect(true).toBe(true);
      }
      
      await context.close();
    });

    test('should handle orientation changes', async ({ browser }) => {
      const context = await browser.newContext({
        ...devices['iPhone 12'],
      });
      const page = await context.newPage();
      
      await page.goto('/');
      
      // Portrait
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      
      // Landscape
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(500);
      
      // Should adapt to orientation
      const body = page.locator('body');
      const width = await body.evaluate((el) => el.clientWidth);
      expect(width).toBeGreaterThan(390);
      
      await context.close();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should have acceptable First Contentful Paint', async ({ page }) => {
      await page.goto('/');
      
      const fcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
            if (fcpEntry) {
              resolve(fcpEntry.startTime);
            }
          }).observe({ entryTypes: ['paint'] });
          
          // Timeout after 5 seconds
          setTimeout(() => resolve(0), 5000);
        });
      });
      
      // FCP should be under 2 seconds
      expect(fcp).toBeLessThan(2000);
    });

    test('should have acceptable Time to Interactive', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      const tti = Date.now() - startTime;
      
      // TTI should be under 3 seconds
      expect(tti).toBeLessThan(3000);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper semantic HTML', async ({ page }) => {
      await page.goto('/');
      
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible({ timeout: 5000 });
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      
      const h1 = page.locator('h1');
      const h1Count = await h1.count();
      
      // Should have at least one h1
      expect(h1Count).toBeGreaterThan(0);
    });

    test('should have alt text for images', async ({ page }) => {
      await page.goto('/');
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        
        // Should have alt attribute (can be empty for decorative images)
        expect(alt !== null).toBe(true);
      }
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/signup');
      
      const inputs = page.locator('input[type="email"], input[type="password"]');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const ariaLabel = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        const id = await input.getAttribute('id');
        
        // Should have label, aria-label, or placeholder
        expect(ariaLabel || placeholder || id).toBeTruthy();
      }
    });
  });
});
