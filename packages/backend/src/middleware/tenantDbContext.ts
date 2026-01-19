import type { NextFunction, Request, Response } from "express";

/**
 * Disabled: The production database of record is Supabase, so we do not
 * establish direct tenant-scoped connections via DATABASE_URL.
 */
export function tenantDbContextMiddleware() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}
