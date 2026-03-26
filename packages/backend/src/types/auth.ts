import { z } from "zod";
import { toCanonicalIdentity } from "./identity";

export const SessionClaimsSchema = z
  .object({
    user_id: z.string(),
    organization_id: z.string().optional(),
    tenant_id: z.string().optional(),
    roles: z.array(z.string()),
    capabilities: z.array(z.string()).optional(),
    session_id: z.string().optional(),
    exp: z.number(),
  })
  .transform((claims) => ({
    ...claims,
    ...toCanonicalIdentity({
      organization_id: claims.organization_id,
      tenant_id: claims.tenant_id,
    }),
  }));

export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

export const TctClaimsSchema = z
  .object({
    iss: z.string(),
    sub: z.string(),
    tid: z.string().optional(),
    organization_id: z.string().optional(),
    roles: z.array(z.string()),
    tier: z.string(),
    exp: z.number(),
  })
  .transform((claims) => ({
    ...claims,
    ...toCanonicalIdentity({
      organization_id: claims.organization_id,
      tid: claims.tid,
    }),
  }));

export type TctClaims = z.infer<typeof TctClaimsSchema>;

export const UserMetaSchema = z
  .object({
    id: z.string(),
    organization_id: z.string().optional(),
    tenant_id: z.string().optional(),
    role: z.string(),
    capabilities: z.array(z.string()).optional(),
  })
  .transform((meta) => ({
    ...meta,
    ...toCanonicalIdentity({
      organization_id: meta.organization_id,
      tenant_id: meta.tenant_id,
    }),
  }));

export type UserMeta = z.infer<typeof UserMetaSchema>;
