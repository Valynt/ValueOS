import { createLogger } from "@shared/lib/logger";

import { TCTPayload } from "../../middleware/tenantContext.js"

const logger = createLogger({ component: "PDP" });

export type Decision = "ALLOW" | "DENY";

export interface PolicyContext {
  resource: string;
  action: string;
  tenantId: string;
  userId: string;
  roles: string[];
  tier: string;
}

/**
 * Policy Decision Plane (PDP)
 * Centralizes access control logic based on Tenant Context Tokens
 */
export class PDP {
  private static instance: PDP;

  private constructor() {}

  static getInstance(): PDP {
    if (!PDP.instance) {
      PDP.instance = new PDP();
    }
    return PDP.instance;
  }

  /**
   * Evaluate a request against policies
   */
  evaluate(tct: TCTPayload, resource: string, action: string): Decision {
    const context: PolicyContext = {
      resource,
      action,
      tenantId: tct.tid,
      userId: tct.sub,
      roles: tct.roles,
      tier: tct.tier,
    };

    // 1. Global Deny: Suspended tenants (mock logic for now)
    if (this.isTenantSuspended(context.tenantId)) {
      logger.warn("Access denied: Tenant suspended", context);
      return "DENY";
    }

    // 2. Role-based access control
    if (context.roles.includes("admin")) {
      return "ALLOW";
    }

    // 3. Resource-specific policies
    return this.evaluateResourcePolicy(context);
  }

  private isTenantSuspended(tenantId: string): boolean {
    // In a real implementation, this would check a cache or DB
    return false;
  }

  private evaluateResourcePolicy(context: PolicyContext): Decision {
    // Simple default logic: allow read, restrict write to editors/admins
    if (context.action === "read") {
      return "ALLOW";
    }

    if (context.action === "write" || context.action === "delete") {
      return context.roles.includes("editor") ? "ALLOW" : "DENY";
    }

    return "DENY";
  }
}

export const pdp = PDP.getInstance();
