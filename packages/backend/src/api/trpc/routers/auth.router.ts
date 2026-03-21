import { z } from "zod";

import { authService } from "../../../services/auth/AuthService.js";
import { protectedProcedure, router } from "../trpc.js";

const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  tenantId: z.string().optional(),
  organizationId: z.string().optional(),
  roles: z.array(z.string()),
  role: z.string().optional(),
  user_metadata: z
    .object({
      full_name: z.string().optional(),
      name: z.string().optional(),
      avatar_url: z.string().optional(),
      role: z.string().optional(),
    })
    .optional(),
});

export const authRouter = router({
  me: protectedProcedure.output(authUserSchema.nullable()).query(({ ctx }) => {
    if (!ctx.user) {
      return null;
    }

    return {
      id: ctx.user.id,
      email: ctx.user.email,
      tenantId: ctx.user.tenantId,
      organizationId: ctx.user.organizationId,
      roles: ctx.user.roles ?? [],
      role: ctx.user.role,
      user_metadata: ctx.user.userMetadata
        ? {
            full_name: ctx.user.userMetadata.fullName,
            name: ctx.user.userMetadata.name,
            avatar_url: ctx.user.userMetadata.avatarUrl,
            role: ctx.user.userMetadata.role,
          }
        : undefined,
    };
  }),

  logout: protectedProcedure.output(z.null()).mutation(async () => {
    await authService.logout();
    return null;
  }),
});
