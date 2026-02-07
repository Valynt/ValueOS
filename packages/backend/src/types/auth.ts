import { z } from "zod";

export const SessionClaimsSchema = z.object({
  user_id: z.string(),
  tenant_id: z.string(),
  roles: z.array(z.string()),
  capabilities: z.array(z.string()).optional(),
  session_id: z.string().optional(),
  exp: z.number(),
});

export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

export const TctClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  tid: z.string(),
  roles: z.array(z.string()),
  tier: z.string(),
  exp: z.number(),
});

export type TctClaims = z.infer<typeof TctClaimsSchema>;

export const UserMetaSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()).optional(),
});

export type UserMeta = z.infer<typeof UserMetaSchema>;
