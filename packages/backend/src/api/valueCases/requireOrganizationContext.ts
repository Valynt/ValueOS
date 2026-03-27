import { NextFunction, Request, Response } from 'express';

/**
 * Resolve tenant context once and normalize it onto req.organizationId.
 * Downstream handlers should consume req.organizationId exclusively.
 */
export function requireOrganizationContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const organizationId = req.tenantId ?? req.user?.tenant_id;

  if (!organizationId) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing organization context',
    });
    return;
  }

  req.organizationId = organizationId;
  next();
}
