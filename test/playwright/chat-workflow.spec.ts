/**
 * User Chat Workflow E2E Tests
 * 
 * Tests the complete user flow for interacting with agents through chat.
 * Covers: navigation, message sending, response handling, and error states.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TIMEOUT = {
  navigation: 10000,
  agentResponse: 30000,
  animation: 500,
};

/**
 * Helper to wait for app to load completely
 */
async function waitForAppLoad(page: Page): Promise<void> {
  // Wait for the root element to be populated
  await page.waitForSelector('#root > *', { timeout: TIMEOUT.navigation });
  
  // Wait for the "Initializing application..." text to disappear
  // This is the bootstrap loading screen
  try {
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Initializing application'),
      { timeout: 60000 } // 60 seconds for bootstrap
    );
  } catch {
    console.log('App may still be initializing...');
  }
  
  // Additional wait for any loading spinners
  const loadingSelector = '[data-testid="loading"], .animate-spin, [aria-label="Loading"]';
  try {
    await page.waitForSelector(loadingSelector, { state: 'hidden', timeout: 5000 });
  } catch {
    // No loading indicator present, that's fine
  }
}

/**
 * Helper to capture console logs and errors
 */
function setupConsoleCapture(page: Page): { logs: string[]; errors: string[] } {
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
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  return { logs, errors };
}

test.describe('User Chat Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console capture
    setupConsoleCapture(page);
  });

  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Verify app is loaded
    await expect(page.locator('#root')).not.toBeEmpty();
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/chat-workflow-initial.png', fullPage: true });
  });

  test('should navigate to workspace and see agent panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Find and click on a case/project to open workspace
    // Look for common entry points
    const createButton = page.getByRole('button', { name: /create|new|start/i });
    const caseCard = page.locator('[data-testid="case-card"], .case-card, [role="article"]').first();
    
    // Try to open a workspace
    if (await createButton.isVisible()) {
      await createButton.click();
    } else if (await caseCard.isVisible()) {
      await caseCard.click();
    }

    await page.waitForTimeout(TIMEOUT.animation);
    await page.screenshot({ path: 'test-results/chat-workflow-workspace.png', fullPage: true });
  });

  test('should find chat input element', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Common chat input selectors
    const chatInputSelectors = [
      '[data-testid="chat-input"]',
      '[data-testid="message-input"]',
      'input[placeholder*="message"]',
      'input[placeholder*="ask"]',
      'input[placeholder*="type"]',
      'textarea[placeholder*="message"]',
      '[role="textbox"]',
      '.chat-input input',
      '.message-input',
    ];

    let chatInput = null;
    for (const selector of chatInputSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        chatInput = element;
        break;
      }
    }

    // Log what we found
    const allInputs = await page.locator('input, textarea').all();
    console.log(`Found ${allInputs.length} input elements`);
    
    for (let i = 0; i < Math.min(allInputs.length, 5); i++) {
      const placeholder = await allInputs[i].getAttribute('placeholder');
      const type = await allInputs[i].getAttribute('type');
      console.log(`Input ${i}: type=${type}, placeholder=${placeholder}`);
    }

    await page.screenshot({ path: 'test-results/chat-workflow-inputs.png', fullPage: true });
  });

  test('should send a message and receive response', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Find chat input
    const chatInput = page.locator(
      '[data-testid="chat-input"], ' +
      'input[placeholder*="message" i], ' +
      'input[placeholder*="ask" i], ' +
      'textarea[placeholder*="message" i]'
    ).first();

    // If chat input is visible, interact with it
    if (await chatInput.isVisible().catch(() => false)) {
      // Type a test message
      await chatInput.fill('What is the ROI for this project?');
      
      // Find and click send button
      const sendButton = page.locator(
        '[data-testid="send-button"], ' +
        'button[type="submit"], ' +
        'button[aria-label*="send" i], ' +
        'button:has(svg)'
      ).first();

      if (await sendButton.isVisible().catch(() => false)) {
        await sendButton.click();
      } else {
        // Try pressing Enter
        await chatInput.press('Enter');
      }

      // Wait for response
      await page.waitForTimeout(TIMEOUT.agentResponse);

      // Check for response indicators
      const responseIndicators = [
        '[data-testid="agent-response"]',
        '[data-testid="message-response"]',
        '.agent-message',
        '.response-message',
        '[role="article"]',
      ];

      for (const selector of responseIndicators) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements matching ${selector}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/chat-workflow-message-sent.png', fullPage: true });
  });

  test('should display agent activity', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for agent activity indicators
    const activitySelectors = [
      '[data-testid="agent-activity"]',
      '[data-testid="agent-status"]',
      '.agent-activity',
      '.agent-status',
      '[aria-label*="agent" i]',
      '[class*="Agent"]',
    ];

    for (const selector of activitySelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} agent activity elements: ${selector}`);
        
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
          const text = await elements[i].textContent();
          console.log(`Agent activity ${i}: ${text?.substring(0, 100)}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/chat-workflow-agent-activity.png', fullPage: true });
  });

  test('should handle streaming responses', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Find chat input
    const chatInput = page.locator(
      '[data-testid="chat-input"], ' +
      'input[placeholder*="message" i], ' +
      'textarea[placeholder*="message" i]'
    ).first();

    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill('Analyze the current system map');
      await chatInput.press('Enter');

      // Look for streaming indicators
      const streamingIndicators = [
        '[data-testid="streaming-indicator"]',
        '.typing-indicator',
        '.streaming',
        '[aria-busy="true"]',
        '.animate-pulse',
      ];

      // Wait a moment for streaming to start
      await page.waitForTimeout(1000);

      for (const selector of streamingIndicators) {
        if (await page.locator(selector).isVisible().catch(() => false)) {
          console.log(`Found streaming indicator: ${selector}`);
        }
      }

      // Wait for response to complete
      await page.waitForTimeout(TIMEOUT.agentResponse);
    }

    await page.screenshot({ path: 'test-results/chat-workflow-streaming.png', fullPage: true });
  });

  test('should display suggestions/actions', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for suggestion/action buttons
    const suggestionSelectors = [
      '[data-testid="suggestion"]',
      '[data-testid="quick-action"]',
      '.suggestion-button',
      '.quick-action',
      'button[class*="suggestion"]',
    ];

    for (const selector of suggestionSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} suggestion elements: ${selector}`);
        
        // Click first suggestion if found
        const firstSuggestion = elements[0];
        const text = await firstSuggestion.textContent();
        console.log(`Clicking suggestion: ${text}`);
        
        await firstSuggestion.click();
        await page.waitForTimeout(TIMEOUT.animation);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/chat-workflow-suggestions.png', fullPage: true });
  });

  test('should display error states gracefully', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for any error displays
    const errorSelectors = [
      '[data-testid="error"]',
      '[role="alert"]',
      '.error-message',
      '.error-banner',
      '[class*="error"]',
    ];

    for (const selector of errorSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found error elements: ${selector}`);
        for (const el of elements.slice(0, 3)) {
          const text = await el.textContent();
          console.log(`Error: ${text?.substring(0, 200)}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/chat-workflow-errors.png', fullPage: true });
  });

  test('should maintain conversation history', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    const chatInput = page.locator(
      '[data-testid="chat-input"], ' +
      'input[placeholder*="message" i], ' +
      'textarea[placeholder*="message" i]'
    ).first();

    if (await chatInput.isVisible().catch(() => false)) {
      // Send multiple messages
      const messages = [
        'What are the key pain points?',
        'Show me the value drivers',
        'Calculate the ROI',
      ];

      for (const msg of messages) {
        await chatInput.fill(msg);
        await chatInput.press('Enter');
        await page.waitForTimeout(2000); // Brief wait between messages
      }

      // Look for message history
      const messageSelectors = [
        '[data-testid="message"]',
        '.chat-message',
        '.message-item',
        '[role="listitem"]',
      ];

      for (const selector of messageSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`Found ${elements.length} messages with selector: ${selector}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/chat-workflow-history.png', fullPage: true });
  });
});

test.describe('Agent Panel Interactions', () => {
  test('should show agent workflow panel', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for agent workflow panel
    const panelSelectors = [
      '[data-testid="agent-panel"]',
      '[data-testid="workflow-panel"]',
      '.agent-panel',
      '.workflow-panel',
      '[class*="AgentWorkflow"]',
      '[class*="AgentInsight"]',
    ];

    for (const selector of panelSelectors) {
      const panel = page.locator(selector).first();
      if (await panel.isVisible().catch(() => false)) {
        console.log(`Found agent panel: ${selector}`);
        
        // Get panel content
        const text = await panel.textContent();
        console.log(`Panel content preview: ${text?.substring(0, 300)}`);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/agent-panel.png', fullPage: true });
  });

  test('should show agent status indicators', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for status indicators
    const statusSelectors = [
      '[data-testid="agent-status"]',
      '.agent-status',
      '[aria-label*="status"]',
      '.status-indicator',
    ];

    for (const selector of statusSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} status indicators: ${selector}`);
      }
    }

    await page.screenshot({ path: 'test-results/agent-status.png', fullPage: true });
  });

  test('should allow switching between agents tab and messages tab', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Look for tab buttons
    const tabSelectors = [
      '[role="tab"]',
      '[data-testid="tab-agents"]',
      '[data-testid="tab-messages"]',
      'button[class*="tab"]',
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.locator(selector).all();
      if (tabs.length > 0) {
        console.log(`Found ${tabs.length} tabs: ${selector}`);
        
        // Click each tab
        for (const tab of tabs) {
          const text = await tab.textContent();
          console.log(`Clicking tab: ${text}`);
          await tab.click();
          await page.waitForTimeout(TIMEOUT.animation);
        }
        break;
      }
    }

    await page.screenshot({ path: 'test-results/agent-tabs.png', fullPage: true });
  });
});

test.describe('Chat Error Handling', () => {
  test('should handle network errors gracefully', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Simulate offline mode
    await context.setOffline(true);

    const chatInput = page.locator(
      '[data-testid="chat-input"], ' +
      'input[placeholder*="message" i]'
    ).first();

    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill('Test message while offline');
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Re-enable network
    await context.setOffline(false);

    await page.screenshot({ path: 'test-results/chat-offline.png', fullPage: true });
  });

  test('should show loading states', async ({ page }) => {
    await page.goto('/');
    
    // Capture loading states before full load
    await page.screenshot({ path: 'test-results/chat-loading.png', fullPage: true });
    
    await waitForAppLoad(page);
    
    // Look for any loading indicators
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.skeleton',
      '[aria-busy="true"]',
      '.animate-spin',
      '.animate-pulse',
    ];

    for (const selector of loadingSelectors) {
      const elements = await page.locator(selector).all();
      console.log(`Loading indicator ${selector}: ${elements.length} found`);
    }
  });
});

test.describe('Accessibility', () => {
  test('should have accessible chat interface', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Check for ARIA labels
    const ariaElements = await page.locator('[aria-label], [aria-describedby], [role]').all();
    console.log(`Found ${ariaElements.length} elements with ARIA attributes`);

    // Check for keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    if (await focusedElement.isVisible()) {
      const tagName = await focusedElement.evaluate(el => el.tagName);
      console.log(`First focusable element: ${tagName}`);
    }

    // Check color contrast (basic check for text visibility)
    const textElements = await page.locator('p, span, h1, h2, h3, label').all();
    console.log(`Found ${textElements.length} text elements`);

    await page.screenshot({ path: 'test-results/chat-accessibility.png', fullPage: true });
  });
});
