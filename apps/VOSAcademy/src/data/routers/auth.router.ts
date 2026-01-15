import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";

/**
 * Authentication router
 * Handles user authentication, session management, and logout
 */
export const authRouter = router({
  /**
   * Get current authenticated user
   * Returns null if not authenticated
   */
  me: publicProcedure.query(({ ctx }) => ctx.user),

  /**
   * Logout current user
   * Clears session cookie and returns success status
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    const cookieString = `${COOKIE_NAME}=; Path=${cookieOptions.path || '/'}; Max-Age=0; HttpOnly; ${cookieOptions.secure ? 'Secure;' : ''} ${cookieOptions.sameSite ? `SameSite=${cookieOptions.sameSite};` : ''}`;
    ctx.res.setHeader('Set-Cookie', cookieString);
    
    return {
      success: true,
    } as const;
  }),
});
