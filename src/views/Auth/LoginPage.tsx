/**
 * Login Page
 * Modern authentication with email/password and OAuth
 */

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const { login, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (location.state as any)?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({
        email,
        password,
        otpCode: showMFA ? otpCode : undefined
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";

      if (errorMessage.includes("rate limit")) {
        setError("Too many login attempts. Please try again later.");
      } else if (errorMessage.includes("MFA_ENROLLMENT_REQUIRED")) {
        setError("Multi-factor authentication is required for your account. Please set it up first.");
      } else if (errorMessage.includes("MFA")) {
        setShowMFA(true);
        setError("Please enter your MFA code");
      } else {
        setError(errorMessage || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple" | "github") => {
    setError("");
    setOauthLoading(provider);

    try {
      await signInWithProvider(provider);
      // Redirect happens automatically via Supabase
    } catch (err: unknown) {
      console.error("OAuth sign in error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "OAuth sign in failed";
      setError(errorMessage);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vc-surface-1 text-white font-sans selection:bg-vc-accent-teal-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-vc-accent-teal-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] z-10 p-6">
        <div className="bg-vc-surface-2 rounded-[32px] border border-white/5 shadow-2xl overflow-hidden relative">
          {/* Top/Bottom accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-20 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

          <div className="p-8 md:p-10">
            {/* Header Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-vc-surface-3 border border-white/10 flex items-center justify-center shadow-inner relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="text-vc-accent-teal-500 relative z-10">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">
                Sign in to VALYNT
              </h1>
              <p className="text-gray-400 text-sm">
                New to the workspace?{" "}
                <Link
                  to="/signup"
                  className="text-vc-accent-teal-400 hover:text-vc-accent-teal-500 transition-colors font-medium"
                >
                  Create an account
                </Link>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Work Email */}
              <div className="space-y-2">
                <label
                  className="text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                  htmlFor="email"
                >
                  Work Email
                </label>
                <div className="group relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-vc-accent-teal-500 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-vc-accent-teal-500/50 focus:border-vc-accent-teal-500/50 transition-all shadow-inner"
                    placeholder="you@studio.dev"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    className="text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    to="/reset-password"
                    className="text-[11px] font-medium text-gray-500 hover:text-vc-accent-teal-400 transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-vc-accent-teal-500 transition-colors" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-12 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-vc-accent-teal-500/50 focus:border-vc-accent-teal-500/50 transition-all shadow-inner"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* MFA Code */}
              {showMFA && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label
                    className="text-[11px] font-bold tracking-wider text-gray-500 uppercase"
                    htmlFor="otpCode"
                  >
                    MFA Code
                  </label>
                  <div className="group relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-vc-accent-teal-500 transition-colors">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <input
                      id="otpCode"
                      type="text"
                      required={showMFA}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-vc-accent-teal-500/50 focus:border-vc-accent-teal-500/50 transition-all shadow-inner"
                      placeholder="123456"
                      disabled={loading}
                      maxLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-vc-accent-teal-500 hover:bg-vc-accent-teal-400 text-black font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(24,195,165,0.3)] hover:shadow-[0_0_30px_rgba(24,195,165,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
              >
                {loading ? "Signing in..." : "Continue to dashboard"}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-vc-surface-2 px-2 text-gray-600">Or</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading || oauthLoading !== null}
                className="flex items-center justify-center py-2.5 rounded-xl border border-white/10 bg-vc-surface-3 hover:bg-vc-surface-3/80 text-white transition-all hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "google" ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => handleOAuthSignIn("apple")}
                disabled={loading || oauthLoading !== null}
                className="flex items-center justify-center py-2.5 rounded-xl border border-white/10 bg-vc-surface-3 hover:bg-vc-surface-3/80 text-white transition-all hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "apple" ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98 0.95-2.05 0.8-3.08 0.35-1.09-0.46-2.09-0.48-3.24 0-1.44 0.62-2.2 0.44-3.06-0.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35 0.07 2.29 0.74 3.08 0.8 1.18-0.24 2.31-0.93 3.57-0.84 1.51 0.12 2.65 0.72 3.4 1.8-3.12 1.87-2.38 5.98 0.48 7.13-0.57 1.5-1.31 2.99-2.54 4.09l0.01-0.01zM12.03 7.25c-0.15-2.23 1.66-4.07 3.74-4.25 0.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => handleOAuthSignIn("github")}
                disabled={loading || oauthLoading !== null}
                className="flex items-center justify-center py-2.5 rounded-xl border border-white/10 bg-vc-surface-3 hover:bg-vc-surface-3/80 text-white transition-all hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "github" ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.04-.015-2.04-3.338.72-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Footer Text */}
            <div className="mt-8 text-center">
              <p className="text-[11px] text-gray-600">
                By continuing, you agree to the VALYNT{" "}
                <Link
                  to="/terms"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
