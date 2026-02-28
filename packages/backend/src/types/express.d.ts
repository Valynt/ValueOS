import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        roles?: string[];
        tenant_id?: string;
        [key: string]: unknown;
      };
      tenantId?: string;
      sessionId?: string;
      userId?: string;
      requestId?: string;
      usageContext?: {
        tenantId: string;
        userId?: string;
        metric: string;
        entitlementCheck: unknown;
        timestamp: string;
      };
    }
  }
}
