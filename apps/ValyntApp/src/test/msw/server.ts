/**
 * MSW Node server for Vitest.
 *
 * Activate by installing msw@^2:
 *   pnpm --filter ValyntApp add -D msw@^2
 *
 * Then uncomment the imports and export below, and wire the lifecycle
 * hooks in src/test/setup.ts (see the commented block there).
 *
 * Until msw is installed, tests use vi.mock() for network interception.
 */

// import { setupServer } from 'msw/node';
// import { agentHandlers } from './handlers/agent';
//
// export const server = setupServer(...agentHandlers);

export const server = null;
