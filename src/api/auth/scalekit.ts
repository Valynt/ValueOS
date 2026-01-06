
import { Request, Response, Router } from "express";
import { Scalekit } from "@scalekit-sdk/node";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { v5 as uuidv5 } from "uuid";
import { createLogger } from "../../lib/logger";
import { settings } from "../../config/settings";

const router = Router();
const logger = createLogger({ component: "ScalekitAuth" });

// Initialize Clients
// Note: These should be validated to exist in a real environment
const scalekit = new Scalekit(
  process.env.SCALEKIT_ENV_URL || "",
  process.env.SCALEKIT_CLIENT_ID || "",
  process.env.SCALEKIT_CLIENT_SECRET || ""
);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Namespace for generating consistent UUIDs from Scalekit string IDs
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * GET /api/auth/scalekit/login
 * Redirects the user to the Scalekit Authorization URL
 */
router.get("/login", (req: Request, res: Response) => {
  try {
    const callbackUrl = `${settings.apiBaseUrl}/api/auth/scalekit/callback`;
    
    const authorizationUrl = scalekit.getAuthorizationUrl(
      callbackUrl,
      { scopes: ["openid", "profile", "email"] }
    );
    
    logger.info("Redirecting to Scalekit for login", { callbackUrl });
    res.redirect(authorizationUrl);
  } catch (error) {
    logger.error("Failed to generate authorization URL", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Failed to initiate login" });
  }
});

/**
 * GET /api/auth/scalekit/callback
 * Handles the redirect from Scalekit, exchanges code for tokens,
 * creates/updates the user in Supabase, and mints a custom JWT.
 */
router.get("/callback", async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    logger.error("Scalekit login error", { error, error_description });
    return res.redirect(`${settings.appUrl}/login?error=${error_description}`);
  }

  if (!code || typeof code !== "string") {
    logger.error("No code provided in callback");
    return res.redirect(`${settings.appUrl}/login?error=no_code`);
  }

  try {
    const callbackUrl = `${settings.apiBaseUrl}/api/auth/scalekit/callback`;

    // A. Exchange code for Scalekit Token
    const { user, accessToken } = await scalekit.authenticateWithCode(
      code,
      callbackUrl
    );

    logger.info("Scalekit authentication successful", { userId: user.id, email: user.email });

    // B. Generate a deterministic UUID based on Scalekit's User ID
    const supabaseUserId = uuidv5(user.id, UUID_NAMESPACE);

    // C. Sync User to Supabase (using Service Role)
    // We strictly use the public.profiles table as planned
    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
      id: supabaseUserId,
      email: user.email,
      full_name: user.name,
      avatar_url: user.avatarUrl,
      updated_at: new Date(),
    });

    if (upsertError) {
        logger.error("Failed to upsert user profile", upsertError);
        throw new Error("Database sync failed");
    }

    // D. Mint Supabase-compatible JWT
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!supabaseJwtSecret) {
        throw new Error("SUPABASE_JWT_SECRET is not configured");
    }

    const supabaseToken = jwt.sign(
      {
        aud: "authenticated", // Required for RLS
        role: "authenticated", // Required for RLS
        sub: supabaseUserId, // The user ID matched in auth.uid()
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 1 week expiry
        app_metadata: {
          provider: "scalekit",
          scalekit_id: user.id,
        },
        user_metadata: {
            full_name: user.name,
            avatar_url: user.avatarUrl,
            email: user.email
        }
      },
      supabaseJwtSecret
    );

    // E. Return to frontend
    // We'll set a cookie and redirect. 
    // Secure, HttpOnly, SameSite=Lax (for top-level navigation)
    res.cookie("sb-access-token", supabaseToken, {
      httpOnly: false, // Allow JS access for now as per the "Frontend Wiring" guide example (it used JS to read it), OR we change to HttpOnly and separate endpoint. 
      // The Plan said: "Integrate Supabase Client with Custom Token".
      // The Guide said: "Retrieve the token (e.g., from cookies...)" and "const accessToken = getCookie('sb-access-token');"
      // If we make it HttpOnly, the JS client can't read it to pass to `createClient`.
      // The Supabase client accepts a custom fetch or `accessToken` option.
      // For simplicity/compatibility with the guide, I will allow JS access (HttpOnly: false) OR
      // I can write a /session endpoint that returns it.
      // Let's stick to the simplest flow: Cookie is accessible to JS, but still Secure in prod.
      secure: settings.isProduction, 
      maxAge: 60 * 60 * 24 * 7 * 1000, // 1 week
      sameSite: "lax",
    });

    res.redirect(`${settings.appUrl}/home`);
  } catch (err) {
    logger.error("Login callback failed", err instanceof Error ? err : new Error(String(err)));
    res.redirect(`${settings.appUrl}/login?error=authentication_failed`);
  }
});

export default router;
