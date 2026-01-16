/**
 * Express Type Augmentation
 *
 * Extends Express Request interface with authenticated user and session data.
 * Required for TypeScript to recognize req.user and req.session properties.
 */

import { Session } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role?: string;
        tenant_id?: string;
        subscription_tier?: "free" | "pro" | "enterprise";
        user_metadata?: Record<string, unknown>;
      };
      session?: {
        access_token?: string;
        refresh_token?: string;
        createdAt?: number;
        lastActivity?: number;
        renewedAt?: number;
      };
    }
  }
}

export {};
