import { Request, Response, NextFunction, RequestHandler } from 'express';

export type ConsentRegistry = {
  hasConsent: (tenantId: string, scope: string) => Promise<boolean> | boolean;
};





export function requireConsent(scope: string, registry: ConsentRegistry): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
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
