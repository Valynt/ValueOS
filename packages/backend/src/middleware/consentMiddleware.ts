import { NextFunction, Request, RequestHandler, Response } from 'express';

import { consentRegistry } from '../services/auth/consentRegistry.js';
import type { ConsentQuery, ConsentRegistry } from '../types/consent';

export type ConsentContextResolver = (req: Request, scope: string) => Omit<ConsentQuery, 'scope'> | null;

export function getAuthenticatedDataSubject(req: Request): string | null {
  return req.user?.sub ?? req.user?.auth0_sub ?? req.user?.id ?? req.userId ?? null;
}

export function resolveAuthenticatedConsentContext(req: Request): Omit<ConsentQuery, 'scope'> | null {
  const tenantId = req.tenantId;
  const subject = getAuthenticatedDataSubject(req);
  const supabase = req.supabase;

  if (!tenantId || !subject || !supabase) {
    return null;
  }

  return {
    tenantId,
    subject,
    supabase,
  };
}

export function requireConsent(
  scope: string,
  registry: ConsentRegistry | null = consentRegistry,
  resolveContext: ConsentContextResolver = resolveAuthenticatedConsentContext
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!registry) {
      return res.status(503).json({
        error: 'Consent registry unavailable',
        message: 'Consent registry is not configured for this environment',
      });
    }

    const context = resolveContext(req, scope);
    if (!context) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Authenticated tenant, subject, and request-scoped Supabase context are required to validate consent.',
      });
    }

    const consentGranted = await registry.hasConsent({
      ...context,
      scope,
    });

    if (!consentGranted) {
      console.warn('Consent check denied', {
        tenantId: context.tenantId,
        subject: context.subject,
        scope,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Consent for the requested operation is not granted.',
      });
    }

    return next();
  };
}
