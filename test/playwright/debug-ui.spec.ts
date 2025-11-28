import { test, expect } from '@playwright/test';

test.describe('UI Debug Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    // Capture ALL console messages before navigating
    const logs: string[] = [];
    const errors: string[] = [];
    
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      logs.push(text);
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`PAGE ERROR: ${error.message}\nSTACK: ${error.stack}`);
      console.log('PAGE ERROR:', error.message);
      console.log('STACK TRACE:', error.stack);
    });

    await page.goto('/');
    
    // Wait for the app to fully load (bootstrap takes time for agent health checks)
    await page.waitForTimeout(20000);
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
    
    // Log page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Print all console logs
    console.log('\n=== ALL CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
    
    // Print errors specifically
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(err => console.log('ERROR:', err));
    }
    
    // Get the root element content
    const rootContent = await page.locator('#root').innerHTML();
    console.log('\n=== ROOT CONTENT ===');
    console.log(rootContent.substring(0, 1000));
    
    // Check page is visible - use a longer timeout
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('capture all visible elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get all visible text content
    const bodyText = await page.locator('body').textContent();
    console.log('Page content preview:', bodyText?.substring(0, 500));
    
    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log('Buttons found:', buttons.length);
    
    // Find all links
    const links = await page.locator('a').all();
    console.log('Links found:', links.length);
    
    // Find all inputs
    const inputs = await page.locator('input').all();
    console.log('Inputs found:', inputs.length);
    
    await page.screenshot({ path: 'test-results/elements.png', fullPage: true });
  });

  test('interactive debug session', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Pause for manual debugging - use `npx playwright test --headed --debug`
    // await page.pause();
    
    await page.screenshot({ path: 'test-results/debug-session.png', fullPage: true });
  });
});
