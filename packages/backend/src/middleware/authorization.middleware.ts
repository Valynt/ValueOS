import { NextFunction, Request, Response } from 'express';
import { createLogger } from '@shared/lib/logger';
import { createServerSupabaseClient } from '@shared/lib/supabase';

const logger = createLogger({ component: 'authorization-middleware' });

interface AuthContext {
  tenantId: string;
  userId: string;
  customerId?: string;  // For customer portal access
  roles: string[];
}

export function requireTenantScope() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = (req as Request & { auth?: AuthContext }).auth;

    if (!auth) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }

    const requestedTenantId = req.params.tenantId || req.body?.tenantId;

    if (!requestedTenantId) {
      res.status(400).json({ error: 'tenant_id required' });
      return;
    }

    if (auth.tenantId !== requestedTenantId) {
      res.status(403).json({ error: 'tenant_access_denied' });
      return;
    }

    next();
  };
}

export function requireCustomerEntitlement() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = (req as Request & { auth?: AuthContext }).auth;

    if (!auth) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }

    const requestedValueCaseId = req.params.valueCaseId || req.params.token;

    if (!auth.customerId) {
      res.status(403).json({ error: 'customer_context_required' });
      return;
    }

    if (!requestedValueCaseId) {
      res.status(400).json({ error: 'value_case_id required' });
      return;
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customer_value_cases')
      .select('id')
      .eq('customer_id', auth.customerId)
      .eq('value_case_id', requestedValueCaseId)
      .maybeSingle();

    if (error) {
      logger.error('Entitlement check failed', undefined, {
        customerId: auth.customerId,
        valueCaseId: requestedValueCaseId,
        dbError: error.message,
        dbCode: error.code,
      });
      res.status(503).json({ error: 'service_unavailable' });
      return;
    }

    if (!data) {
      res.status(403).json({ error: 'customer_access_denied' });
      return;
    }

    next();
  };
}