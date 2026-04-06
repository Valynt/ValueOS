/**
 * MSW handlers for agent API endpoints.
 *
 * These handlers are used in tests that require network-level interception
 * (e.g., asserting request headers, testing SSE stream lifecycle).
 *
 * Usage: import { agentHandlers } from './agent' and pass to setupServer().
 *
 * NOTE: Activate by installing msw@^2 and adding handlers.
 * Until then, tests that need SSE mocking use a manual EventSource mock
 * (see src/hooks/__tests__/useAgentStream.test.ts).
 */

export const agentHandlers: never[] = [];
