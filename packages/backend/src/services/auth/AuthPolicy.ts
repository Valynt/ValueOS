import { z } from "zod";

import { AuthenticationError } from "./errors.js";

export const UserMetaSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()).optional(),
});

export type UserMeta = z.infer<typeof UserMetaSchema>;

export function assertTenantMember(ctx: { user?: UserMeta }, tenantId: string) {
  if (!ctx.user || ctx.user.tenant_id !== tenantId) {
    deny("tenant_denied", "User is not a member of the tenant");
  }
}

export function assertCapability(
  ctx: { user?: UserMeta },
  capability: string,
  opts?: { tenantId?: string; target?: any }
) {
  if (!ctx.user || !ctx.user.capabilities?.includes(capability)) {
    deny("capability_denied", `Missing capability: ${capability}`);
  }
  if (opts?.tenantId && ctx.user.tenant_id !== opts.tenantId) {
    deny("tenant_denied", "User is not a member of the tenant");
  }
}

export function isPrivilegedAction(action: string): boolean {
  return ["admin", "super_admin", "manager"].includes(action);
}

export function deny(code: string, message: string): never {
  throw new AuthenticationError(`${code}: ${message}`);
}

export function toAuthError(err: any) {
  return {
    code: err.code || "auth_error",
    httpStatus: err.httpStatus || 401,
    message: err.message || "Authentication failed",
    safeMessage: "Authentication failed. Please try again.",
  };
}
