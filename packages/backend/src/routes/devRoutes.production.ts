/**
 * Production-only dev-route boundary.
 *
 * The production esbuild graph resolves the server's devRoutes import to
 * this module. There is deliberately no import of the development HTTP
 * router, no module capable of invoking an OS shell, and no fallback
 * path to a development handler in the distributed backend.
 */
import type { Application } from 'express';

export function assertDevRoutesConfiguration(): void {
  if (process.env.ENABLE_DEV_ROUTES === 'true') {
    process.stderr.write(
      '[Security] FATAL: the production backend refuses ENABLE_DEV_ROUTES=true.\n',
    );
    process.exit(1);
  }
}

export async function registerDevRoutes(_app: Application): Promise<boolean> {
  return false;
}
