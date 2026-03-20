/**
 * Modern Signup Page
 * Sleek registration with VALYNT-style design
 */

import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";

export function ModernSignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { signup, resendVerificationEmail, signInWithProvider } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerificationNotice("");
    setLoading(true);

    try {
      const result = await signup({ email, password, fullName });
      if (result.requiresEmailVerification) {
        setVerificationNotice("Check your email to verify your account.");
        return;
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setLoading(true);
    try {
      await resendVerificationEmail(email);
      setVerificationNotice("Verification email resent. Please check your inbox.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resend verification email";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setError("");
    setOauthLoading(true);

    try {
      await signInWithProvider(provider);
      // Redirect happens automatically via Supabase
    } catch (err: unknown) {
      console.error("OAuth sign in error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "OAuth sign in failed";
      setError(errorMessage);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm mx-auto space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-black text-base tracking-tighter">V</span>
          </div>
          <span className="text-lg font-black text-foreground tracking-[-0.05em]">VALUEOS</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-8 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          {/* Notices */}
          {verificationNotice && (
            <div role="alert" className="p-3 rounded-md bg-success/10 border border-success/20 text-success text-xs text-center">
              {verificationNotice}
              <button
                type="button"
                onClick={handleResendVerification}
                className="ml-2 underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                Resend
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-xs font-medium text-foreground">Full Name</label>
              <input
                id="fullName"
                placeholder="John Doe"
                type="text"
                autoCapitalize="words"
                autoComplete="name"
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading || oauthLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground">Email</label>
              <input
                id="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || oauthLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  id="password"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || oauthLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading || oauthLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:pointer-events-none disabled:opacity-50"
              disabled={loading || oauthLoading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={loading || oauthLoading}
            className="inline-flex items-center justify-center w-full h-9 gap-2 rounded-md border border-border bg-white/5 text-foreground text-sm font-medium hover:bg-white/8 transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {oauthLoading ? "Connecting..." : "Google"}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          By clicking continue, you agree to our{" "}
          <a href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
