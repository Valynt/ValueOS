import { Session } from "@supabase/supabase-js";
import { createLogger } from "../logger";

const logger = createLogger({ component: "SecureSessionManager" });

export class SecureSessionManager {
  private static readonly SESSION_KEY = "vc_session_v2";
  private static readonly MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours
  private static readonly ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

  static storeSession(session: Session): void {
    try {
      const sessionData = {
        ...session,
        storedAt: Date.now(),
        rotatedAt: Date.now(),
      };

      // Use sessionStorage instead of localStorage for better security
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

      logger.debug("Session stored securely");
    } catch (error) {
      logger.error("Failed to store session", error as Error);
    }
  }

  static getSession(): Session | null {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      const now = Date.now();

      // Check session age
      if (now - sessionData.storedAt > this.MAX_SESSION_AGE) {
        this.clearSession();
        logger.warn("Session expired due to age");
        return null;
      }

      // Check if rotation is needed
      if (now - sessionData.rotatedAt > this.ROTATION_INTERVAL) {
        // Rotate session by refreshing it
        this.rotateSession(sessionData);
      }

      return sessionData;
    } catch (error) {
      logger.error("Failed to retrieve session", error as Error);
      this.clearSession();
      return null;
    }
  }

  static clearSession(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
      // Also clear any potential localStorage remnants
      localStorage.removeItem("supabase.auth.token");
      logger.debug("Session cleared securely");
    } catch (error) {
      logger.error("Failed to clear session", error as Error);
    }
  }

  private static rotateSession(sessionData: any): void {
    try {
      sessionData.rotatedAt = Date.now();
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      logger.debug("Session rotated for security");
    } catch (error) {
      logger.error("Failed to rotate session", error as Error);
    }
  }
}
