// Test-only stub. Exists so Vite can resolve @/const imports from client/src
// files when running in the ValyntApp vitest context. Every export is mocked
// via vi.mock('@/const') before any test runs.
//
// The real implementations live in client/src/const.ts.
// This file must never be imported in production code.
if (process.env["NODE_ENV"] === 'production') {
  throw new Error(
    '[ValyntApp/src/const.ts] This stub must not be imported in production. ' +
    'Import from client/src/const.ts directly or via the root @ alias.',
  );
}

export const getLoginUrl = () => '/login';
export const COOKIE_NAME = 'auth-token';
export const ONE_YEAR_MS = 31_536_000_000;
