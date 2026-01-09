import { NextFunction, Request, RequestHandler, Response } from 'express';
import { consentRegistry } from '../services/consentRegistry';
import type { ConsentRegistry } from '../types/consent';

export function requireConsent(
  scope: string,
  registry: ConsentRegistry | null = consentRegistry
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!registry) {
      return res.status(503).json({
        error: 'Consent registry unavailable',
        message: 'Consent registry is not configured for this environment',
      });
    }

    const tenantId = (req.headers['x-tenant-id'] as string) || (req as any).tenantId || 'default';

    const consentGranted = await registry.hasConsent(tenantId, scope);
    if (!consentGranted) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Consent for scope "${scope}" is not granted for tenant ${tenantId}`
      });
    }

    return next();
  };
}
