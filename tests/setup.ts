/**
 * Test Setup
 * 
 * Global test configuration and setup for Vitest.
 * This is the unified test setup for /tests/ directory structure.
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables
process.env.VITE_APP_ENV = 'test';
process.env.VITE_APP_URL = 'http://localhost:5173';
process.env.VITE_API_BASE_URL = 'http://localhost:3000';
process.env.VITE_AGENT_API_URL = 'http://localhost:8000/api/agents';
process.env.VITE_MOCK_AGENTS = 'true';
process.env.TEST_MODE = 'true';

// Real Supabase credentials for integration tests
// Tests will connect to actual database - no mocks!
process.env.VITE_SUPABASE_URL = 'https://bxaiabnqalurloblfwua.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4YWlhYm5xYWx1cmxvYmxmd3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwNjI3ODcsImV4cCI6MjA0ODYzODc4N30.gK3zXg3EqoBBRwHqKsEP5hCgxvtMQ-N0v-lCO_kYm88';

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.subtle for password hashing tests
if (!global.crypto) {
  global.crypto = {} as Crypto;
}

if (!global.crypto.subtle) {
  global.crypto.subtle = {
    digest: vi.fn(),
    importKey: vi.fn(),
    deriveBits: vi.fn(),
  } as any;
}

if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  });
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Extend expect with custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
