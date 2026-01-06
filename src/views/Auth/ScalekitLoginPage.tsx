import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingSpinner } from "../../components/Common/LoadingSpinner";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "ScalekitLoginPage" });

/**
 * Scalekit Login Page
 * This page serves as a dedicated entry point for Scalekit authentication,
 * mirroring the path structure expected for Enterprise SSO flows.
 */
export default function ScalekitLoginPage() {
  const { signInWithScalekit } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const organizationId = params.get("org") || undefined;
    const idpToken = params.get("idp_initiated_login");

    logger.info("Initiating Scalekit login flow", {
      organizationId,
      hasIdpToken: !!idpToken,
    });

    // We use a small delay to ensure the user sees the "Connecting" UI
    // and to avoid immediate redirect issues in some browsers
    const timer = setTimeout(() => {
      signInWithScalekit({
        organizationId,
        idpInitiatedLogin: idpToken || undefined,
      }).catch((err) => {
        logger.error("Failed to initiate Scalekit login", err);
        setError(err.message || "Failed to connect to identity provider.");
      });
    }, 1000);

    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [signInWithScalekit]);

  const handleManualRetry = () => {
    const params = new URLSearchParams(window.location.search);
    signInWithScalekit({
      organizationId: params.get("org") || undefined,
      idpInitiatedLogin: params.get("idp_initiated_login") || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vc-surface-1 text-white font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 text-center max-w-sm px-6">
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-vc-surface-3 border border-white/10 flex items-center justify-center shadow-2xl relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent" />
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500 relative z-10"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Enterprise Access
        </h1>
        {error ? (
          <div className="space-y-4">
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              {error}
            </p>
            <button
              onClick={handleManualRetry}
              className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-emerald-50 transition-all shadow-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm leading-relaxed">
              Establishing a secure connection to your identity provider. Please
              wait a moment.
            </p>
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner />
              {countdown === 0 && (
                <button
                  onClick={handleManualRetry}
                  className="text-emerald-400 text-xs hover:text-emerald-300 transition-colors underline underline-offset-4"
                >
                  Click here if you aren't redirected automatically
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold">
            Powered by Scalekit
          </p>
        </div>
      </div>
    </div>
  );
}
