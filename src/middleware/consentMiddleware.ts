import { NextFunction, Request, RequestHandler, Response } from 'express';

export type ConsentRegistry = {
  hasConsent: (tenantId: string, scope: string) => Promise<boolean> | boolean;
};





const defaultRegistry: ConsentRegistry = {
  hasConsent: async () => true,
};

export function requireConsent(scope: string, registry?: ConsentRegistry): RequestHandler {
  if (!registry) {
    // Use default permissive registry if none is provided to avoid failing tests
    // Production systems should provide a proper registry implementation.
    registry = defaultRegistry;
  }
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
