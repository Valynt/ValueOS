// Test-only stub. Exists so Vite can resolve @/lib/trpc imports from client/src
// files when running in the ValyntApp vitest context. The export is mocked
// via vi.mock('@/lib/trpc') before any test runs.
//
// The real tRPC client lives in client/src/lib/trpc.ts.
// This file must never be imported in production code.
if (process.env["NODE_ENV"] === 'production') {
  throw new Error(
    '[ValyntApp/src/lib/trpc.ts] This stub must not be imported in production. ' +
    'Import from client/src/lib/trpc.ts directly or via the root @ alias.',
  );
}

// Typed as unknown so accidental use without mocking fails loudly at the call site.
export const trpc: unknown = {};
