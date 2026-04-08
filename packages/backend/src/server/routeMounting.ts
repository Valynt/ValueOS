import type { Application } from "express";

export interface RouteMountingBundle {
  mount: (app: Application) => void;
}

/**
 * Extracted route mounting lifecycle wrapper so server.ts remains an orchestration shell.
 */
export function mountApplicationRoutes(
  app: Application,
  bundle: RouteMountingBundle
): void {
  bundle.mount(app);
}
