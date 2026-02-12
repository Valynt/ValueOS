/**
 * Modern Login Page
 * Sleek authentication with VALYNT-style design
 */

import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { getSupportedLocales } from "../../i18n";
import type { LocaleCode } from "../../i18n/config";
import { useI18n } from "../../i18n/I18nProvider";
import { logger } from "../../lib/logger";

export function ModernLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { login, signInWithProvider } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const locales = getSupportedLocales();
  const navigate = useNavigate();
  const location = useLocation();

   
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const logPrefix = "[LoginPage]";
    logger.info(`${logPrefix} 🚀 Form submitted`);
    logger.info(`${logPrefix} Email: ${email}`);
    logger.info(`${logPrefix} Password length: ${password.length}`);
    logger.info(`${logPrefix} Redirect target: ${from}`);

    try {
      logger.info(`${logPrefix} 📡 Calling login()...`);
      await login({ email, password });
      logger.info(`${logPrefix} ✅ login() returned successfully`);
      logger.info(`${logPrefix} 🔀 Navigating to: ${from}`);
      navigate(from, { replace: true });
      logger.info(`${logPrefix} ✅ navigate() called`);
    } catch (err: unknown) {
      console.error(`${logPrefix} ❌ Login error:`, err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      logger.info(`${logPrefix} Error message: ${errorMessage}`);

      if (errorMessage.includes("rate limit")) {
        setError("Too many login attempts. Please try again later.");
      } else {
        setError(errorMessage || "Invalid email or password");
      }
    } finally {
      logger.info(`${logPrefix} 🏁 Login attempt finished, loading=false`);
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
      const errorMessage = err instanceof Error ? err.message : "OAuth sign in failed";
      setError(errorMessage);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center antialiased selection:bg-zinc-800 selection:text-zinc-200 text-zinc-50 bg-black p-4">
      {/* Animated Background */}
      <div
        className="fixed top-0 w-full h-screen -z-10"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 0%, black 80%, transparent)",
        }}
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[320px] sm:max-w-[350px] mx-auto space-y-8">
        {/* Brand & Header */}
        <div className="flex flex-col items-center space-y-6 text-center">
          {/* Logo Lockup */}
          <div className="flex items-center gap-3 select-none">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M12 2L22 12L12 22L2 12L7 7H12" />
            </svg>
            <span className="text-2xl tracking-[0.2em] text-white font-medium">VALUEOS</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-white tracking-tight">{t("auth.welcomeBack", "Welcome back")}</h1>
            <p className="text-xs text-zinc-400">
              {t("auth.noAccount", "Don't have an account?")}{" "}
              <Link
                to="/signup"
                className="font-medium text-white underline underline-offset-4 hover:text-zinc-300 transition-colors"
              >
                {t("auth.signUp", "Sign up")}
              </Link>
            </p>
          </div>
        </div>


        <div className="flex justify-end">
          <label className="text-[11px] text-zinc-400 flex items-center gap-2">
            {t("auth.language", "Language")}
            <select
              value={locale}
              onChange={(event) => void setLocale(event.target.value as LocaleCode)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
              aria-label={t("auth.language", "Language")}
            >
              {locales.map((supportedLocale) => (
                <option key={supportedLocale.code} value={supportedLocale.code}>
                  {supportedLocale.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center"
          >
            {error}
          </div>
        )}

        {/* Authentication Form */}
        <div className="grid gap-5">
          <form onSubmit={handleSubmit} className="grid gap-4">
            {/* Email Input */}
            <div className="grid gap-2">
              <label htmlFor="email" className="text-xs font-medium leading-none text-zinc-300">
                {t("auth.email", "Email")}
              </label>
              <input
                id="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || oauthLoading}
              />
            </div>

            {/* Password Input */}
            <div className="grid gap-2">
              <label htmlFor="password" className="text-xs font-medium leading-none text-zinc-300">
                {t("auth.password", "Password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || oauthLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:text-zinc-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading || oauthLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white text-black hover:bg-zinc-200 h-9 w-full shadow-[0_0_20px_-5px_rgba(255,255,255,0.15)]"
              disabled={loading || oauthLoading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t("auth.signingIn", "Signing in...")}
                </span>
              ) : (
                t("auth.signIn", "Sign in")
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-black px-2 text-zinc-500 font-medium">{t("auth.continueWith", "Or continue with")}</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            onClick={() => handleOAuthSignIn("google")}
            disabled={loading || oauthLoading}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-zinc-800 bg-black hover:bg-zinc-900 hover:border-zinc-700 text-zinc-200 h-9 w-full gap-2"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {oauthLoading ? "Connecting..." : "Google"}
          </button>
        </div>

        {/* Footer */}
        <p className="px-4 text-center text-xs text-zinc-600 leading-relaxed">
          By clicking continue, you agree to our{" "}
          <a
            href="/terms"
            className="underline underline-offset-4 hover:text-zinc-400 transition-colors"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            className="underline underline-offset-4 hover:text-zinc-400 transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
