/**
 * Test Setup
 *
 * Global test configuration and setup for Vitest.
 */

import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';
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

// Supabase credentials for integration tests — read from environment, fall back to local supabase-demo keys
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';

const LOCAL_TEST_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const resolveSupabaseAnonKey = (): string => {
  if (process.env.VITE_SUPABASE_ANON_KEY) {
    return process.env.VITE_SUPABASE_ANON_KEY;
  }

  // Local test-only fallback key for dev/test runs.
  if (process.env.NODE_ENV === 'test') {
    return LOCAL_TEST_SUPABASE_ANON_KEY;
  }

  throw new Error(
    'VITE_SUPABASE_ANON_KEY fallback can only be used when NODE_ENV is "test".',
  );
};

process.env.VITE_SUPABASE_ANON_KEY = resolveSupabaseAnonKey();

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
