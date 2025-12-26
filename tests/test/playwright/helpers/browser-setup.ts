/**
 * Playwright Browser Setup Helpers
 * Utilities for configuring browser testing in different environments
 */

import { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Get base URL based on environment
 */
export function getBaseURL(): string {
  // Check environment variables
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL;
  }
  
  // Check for Codespaces
  if (process.env.CODESPACES) {
    const codespaceName = process.env.CODESPACE_NAME;
    return `https://${codespaceName}-3000.preview.app.github.dev`;
  }
  
  // Check for Gitpod
  if (process.env.GITPOD_WORKSPACE_URL) {
    const workspaceUrl = process.env.GITPOD_WORKSPACE_URL;
    return workspaceUrl.replace('https://', 'https://3000-');
  }
  
  // Default to localhost
  return 'http://localhost:3000';
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(
  url: string = getBaseURL(),
  timeout: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    // Wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Server not ready after ${timeout}ms`);
}

/**
 * Configure browser context for testing
 */
export async function setupBrowserContext(
  browser: Browser,
  options: {
    viewport?: { width: number; height: number };
    locale?: string;
    timezone?: string;
    permissions?: string[];
  } = {}
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 720 },
    locale: options.locale || 'en-US',
    timezoneId: options.timezone || 'America/New_York',
    permissions: options.permissions || [],
    // Enable video recording for debugging
    recordVideo: process.env.CI ? undefined : {
      dir: 'test-results/videos',
      size: { width: 1280, height: 720 },
    },
  });
  
  return context;
}

/**
 * Setup page with common configurations
 */
export async function setupPage(
  context: BrowserContext,
  options: {
    baseURL?: string;
    extraHTTPHeaders?: Record<string, string>;
  } = {}
): Promise<Page> {
  const page = await context.newPage();
  
  // Set base URL
  if (options.baseURL) {
    await page.goto(options.baseURL);
  }
  
  // Set extra headers
  if (options.extraHTTPHeaders) {
    await page.setExtraHTTPHeaders(options.extraHTTPHeaders);
  }
  
  // Add console log listener for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Browser console error: ${msg.text()}`);
    }
  });
  
  // Add page error listener
  page.on('pageerror', error => {
    console.error(`Page error: ${error.message}`);
  });
  
  return page;
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/screenshots/${name}-${timestamp}.png`;
  
  await page.screenshot({
    path: filename,
    fullPage: true,
  });
  
  return filename;
}

/**
 * Check if running in container/Codespace
 */
export function isContainerEnvironment(): boolean {
  return !!(
    process.env.CODESPACES ||
    process.env.GITPOD_WORKSPACE_URL ||
    process.env.DEVCONTAINER
  );
}

/**
 * Get recommended browser launch options
 */
export function getBrowserLaunchOptions() {
  const isContainer = isContainerEnvironment();
  
  return {
    headless: process.env.CI ? true : false,
    // Use no-sandbox in containers
    args: isContainer ? [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ] : [],
    // Increase timeout for containers
    timeout: isContainer ? 60000 : 30000,
  };
}
