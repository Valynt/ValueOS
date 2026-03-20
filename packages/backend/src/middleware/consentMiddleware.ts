import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getRequestSupabaseClient } from '@shared/lib/supabase';

import { consentRegistry } from '../services/auth/consentRegistry.js';
import type { ConsentCheckRequest, ConsentRegistry } from '../types/consent';

export function getAuthenticatedDataSubject(req: Request): string | null {
  return req.user?.sub ?? req.user?.auth0_sub ?? req.user?.id ?? req.userId ?? null;
}

export function getCanonicalSubjectFromRequest(req: Request): string | null {
  const subject = req.user?.sub ?? req.user?.auth0_sub ?? req.user?.id;
  return typeof subject === 'string' && subject.length > 0 ? subject : null;
}

export function requireConsent(
  scope: string,
  registry: ConsentRegistry | null = consentRegistry,
  resolveSubject: (req: Request) => string | null = getCanonicalSubjectFromRequest
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!registry) {
      return res.status(503).json({
        error: 'Consent registry unavailable',
        message: 'Consent registry is not configured for this environment',
      });
    }

    const tenantId = req.tenantId ?? req.user?.tenant_id ?? req.user?.organization_id;
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Authenticated tenant, subject, and request-scoped Supabase context are required to validate consent.',
      });
    }

    const subject = resolveSubject(req);
    if (!subject) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'An authenticated subject is required to validate consent.',
      });
    }

    let supabase;
    try {
      supabase = getRequestSupabaseClient(req);
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'A request-scoped authenticated client is required to validate consent.',
      });
    }

    const consentGranted = await registry.hasConsent({
      tenantId,
      scope,
      subject,
      supabase,
    });

    if (!consentGranted) {
      console.warn('Consent check denied', {
        tenantId,
        subject,
        scope,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Consent for scope "${scope}" is not granted for subject ${subject} in tenant ${tenantId}`,
      });
    }

    return next();
  };
}
