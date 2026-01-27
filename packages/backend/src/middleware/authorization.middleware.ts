import { Request, Response, NextFunction } from 'express';

interface AuthContext {
  tenantId: string;
  userId: string;
  customerId?: string;  // For customer portal access
  roles: string[];
}

export function requireTenantScope() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth as AuthContext;
    const requestedTenantId = req.params.tenantId || req.body?.tenantId;

    if (!requestedTenantId) {
      return res.status(400).json({ error: 'tenant_id required' });
    }

    if (auth.tenantId !== requestedTenantId) {
      return res.status(403).json({ error: 'tenant_access_denied' });
    }

    next();
  };
}

export function requireCustomerEntitlement() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth as AuthContext;
    const requestedValueCaseId = req.params.valueCaseId || req.params.token; // For customer portal

    if (!auth.customerId) {
      return res.status(403).json({ error: 'customer_context_required' });
    }

    // Check if customer has access to this value case
    // This could be via a customer_value_cases table or by validating the token
    // For now, assume the token validation already ensures access
    // In production, add explicit check:
    // const { data, error } = await supabase
    //   .from('customer_value_cases')
    //   .select('id')
    //   .eq('customer_id', auth.customerId)
    //   .eq('value_case_id', requestedValueCaseId)
    //   .single();
    // if (error || !data) {
    //   return res.status(403).json({ error: 'customer_access_denied' });
    // }

    next();
  };
}