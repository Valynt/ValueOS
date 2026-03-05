import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getProfileByUserId, updateProfile } from "../db";

export const profileRouter = router({
  /**
   * Get the current user's full profile.
   * Returns all profile fields including preferences.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getProfileByUserId(ctx.user.id);
    if (!profile) {
      return {
        id: ctx.user.id,
        openId: ctx.user.openId,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        displayName: null,
        avatarUrl: null,
        bio: null,
        company: null,
        jobTitle: null,
        timezone: "UTC",
        preferences: null,
        createdAt: ctx.user.createdAt,
        updatedAt: ctx.user.updatedAt,
        lastSignedIn: ctx.user.lastSignedIn,
      };
    }
    return profile;
  }),

  /**
   * Update the current user's profile fields.
   * Only provided fields are updated; omitted fields remain unchanged.
   */
  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().max(255).nullish(),
        bio: z.string().max(500).nullish(),
        company: z.string().max(255).nullish(),
        jobTitle: z.string().max(255).nullish(),
        timezone: z.string().max(64).optional(),
        avatarUrl: z.string().url().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateProfile(ctx.user.id, {
        displayName: input.displayName,
        bio: input.bio,
        company: input.company,
        jobTitle: input.jobTitle,
        timezone: input.timezone,
        avatarUrl: input.avatarUrl,
      });

      const updated = await getProfileByUserId(ctx.user.id);
      return updated;
    }),

  /**
   * Update the current user's preferences (theme, notifications, etc.).
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        theme: z.enum(["light", "dark", "system"]).optional(),
        emailNotifications: z.boolean().optional(),
        agentNotifications: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Merge with existing preferences
      const existing = await getProfileByUserId(ctx.user.id);
      const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};
      const merged = { ...currentPrefs, ...input };

      await updateProfile(ctx.user.id, { preferences: merged });
      return merged;
    }),
});
