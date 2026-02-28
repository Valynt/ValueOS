import { expect, test } from '@playwright/test';

test.describe('Frontend Startup Health Check', () => {
  test('page loads without env validation errors', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      errors.push(err.message);
      console.error('[Page Error]', err.message);
    });

    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for specific env error
    const hasEnvError = errors.some(e => 
      e.includes('startup configuration is invalid') ||
      e.includes('VITE_SUPABASE_URL') ||
      e.includes('VITE_SUPABASE_ANON_KEY')
    );
    
    expect(hasEnvError, `Env validation errors found: ${errors.join(', ')}`).toBe(false);
    
    // Check page is actually rendered (not blank)
    const body = await page.locator('body').innerHTML();
    expect(body.length).toBeGreaterThan(100);
  });

  test('debug env values in browser', async ({ page }) => {
    await page.goto('/');
    
    // Wait a bit for scripts to run
    await page.waitForTimeout(2000);
    
    // Get console logs that contain our debug output
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });
    
    // Reload to get fresh logs
    await page.reload();
    await page.waitForTimeout(2000);
    
    const debugLogs = logs.filter(l => l.includes('[DEBUG]'));
    console.log('Debug logs found:', debugLogs);
    
    // Check if VITE_SUPABASE_URL is loaded
    const urlLog = debugLogs.find(l => l.includes('VITE_SUPABASE_URL'));
    const keyLog = debugLogs.find(l => l.includes('VITE_SUPABASE_ANON_KEY'));
    
    if (urlLog) {
      const url = urlLog.split('VITE_SUPABASE_URL:')[1]?.trim();
      expect(url).not.toBe('');
      expect(url).not.toBeUndefined();
      expect(url).not.toContain('your-');
      expect(url).not.toContain('placeholder');
    }
    
    if (keyLog) {
      const key = keyLog.split('VITE_SUPABASE_ANON_KEY:')[1]?.trim();
      expect(key).not.toBe('');
      expect(key).not.toBeUndefined();
      expect(key).not.toBe('...');
    }
  });

  test('verify import.meta.env is accessible', async ({ page }) => {
    await page.goto('/');
    
    // Inject a script to check env values directly
    const envValues = await page.evaluate(() => {
      return {
        url: (window as any).__VITE_SUPABASE_URL__ || 'not-found',
        hasKey: !!(window as any).__VITE_SUPABASE_ANON_KEY__,
        allEnvKeys: Object.keys((window as any)).filter(k => k.includes('SUPABASE')),
      };
    });
    
    console.log('Env values from page:', envValues);
  });
});
