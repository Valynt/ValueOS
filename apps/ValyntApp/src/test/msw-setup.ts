/**
 * MSW server setup — imported explicitly by tests that need network-level
 * SSE/fetch interception. Not included in the global setup.ts to avoid
 * polluting tests that don't need it.
 *
 * Usage in a test file:
 *   import "@/test/msw-setup";
 *   import { mswServer } from "@/test/msw-setup";
 */

// fetch globals are polyfilled by fetch-polyfill.ts (in vitest setupFiles)
// before this module is imported.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { agentHandlers } from "./handlers/agent-sse";

export const mswServer = setupServer(...agentHandlers);

beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
