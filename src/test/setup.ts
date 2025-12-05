import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';

// Re-use existing global setup for env vars and polyfills
import '../../test/setup';

export const server = setupServer();

beforeAll(() => {
  vi.setSystemTime(new Date('2025-01-01T12:00:00-05:00'));
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
