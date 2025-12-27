/**
 * OAuth Callback Handler
 * Handles OAuth redirect and session exchange after third-party authentication
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { LoadingSpinner } from "../../components/Common/LoadingSpinner";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "AuthCallback" });

const REDIRECT_DELAY_MS = 2000; // Delay before redirecting on error to show message

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        logger.info("Processing OAuth callback");

        // Exchange the OAuth code for a session
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error("OAuth session exchange failed", sessionError);
          setError("Authentication failed. Please try again.");
          setTimeout(
            () => navigate("/login?error=oauth_failed"),
            REDIRECT_DELAY_MS
          );
          return;
        }

        if (!data.session) {
          logger.warn("No session found after OAuth callback");
          setError("No session found. Redirecting to login...");
          setTimeout(
            () => navigate("/login?error=no_session"),
            REDIRECT_DELAY_MS
          );
          return;
        }

        logger.info("OAuth session exchange successful", {
          userId: data.session.user.id,
        });

        // Session is now stored and AuthContext will pick it up via onAuthStateChange
        // Redirect to home page
        navigate("/home", { replace: true });
      } catch (err) {
        logger.error("Unexpected error during OAuth callback", err as Error);
        setError("An unexpected error occurred. Please try again.");
        setTimeout(
          () => navigate("/login?error=unexpected"),
          REDIRECT_DELAY_MS
        );
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <LoadingSpinner />
        {error ? (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        ) : (
          <p className="mt-4 text-slate-300 text-sm">Completing sign in...</p>
        )}
      </div>
    </div>
  );
}
