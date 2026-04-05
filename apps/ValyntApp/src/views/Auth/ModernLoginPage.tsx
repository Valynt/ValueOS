/**
 * Modern Login Page - Split Layout Design
 *
 * New design matching Figma exports with:
 * - Left panel: Branding + Economic Intelligence tagline
 * - Right panel: Login form with Material Design 3 styling
 * - Glassmorphism floating badge
 * - Light theme (replaces dark theme)
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '@/contexts/AuthContext';
import { getSupportedLocales } from '@/i18n';
import type { LocaleCode } from '@/i18n/config';
import { useI18n } from '@/i18n/I18nProvider';
import { logger } from '@/lib/logger';
import { authRateLimiter, AuthRateLimitError, parseAuthLockoutMetadata } from '@/lib/rateLimiter';
import { GlassCard } from '@/components/ui/GlassCard';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { floatingBadge } from '@/lib/animations';
import { cn } from '@/lib/utils';

export function ModernLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { login, signInWithProvider } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const locales = getSupportedLocales();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const logPrefix = '[LoginPage]';
    logger.info(`${logPrefix} Form submitted`);

    // UX-only local hint. Do not block auth attempts based on local storage data.
    const localStatus = authRateLimiter.canAttemptAuth(email.toLowerCase());
    if (!localStatus.allowed && typeof localStatus.lockoutRemaining === 'number') {
      setError(
        `Too many local attempts on this browser. Verifying server lockout status... (~${localStatus.lockoutRemaining}m)`,
      );
    }

    try {
      await login({ email, password });
      authRateLimiter.recordSuccessfulAttempt(email.toLowerCase());
      logger.info(`${logPrefix} Login successful, navigating to: ${from}`);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      logger.error(`${logPrefix} Login error:`, err);
      const serverLockout =
        err instanceof AuthRateLimitError
          ? err.lockout
          : parseAuthLockoutMetadata(err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      if (serverLockout?.locked) {
        const retryAfterSeconds = serverLockout.retryAfterSeconds;
        if (typeof retryAfterSeconds === 'number') {
          const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
          setError(`Too many login attempts. Try again in about ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`);
        } else {
          setError('Too many login attempts. Please try again later.');
        }
        return;
      }

      const localAttempt = authRateLimiter.recordFailedAttempt(email.toLowerCase());
      if (localAttempt.isLocked && typeof localAttempt.lockoutRemaining === 'number') {
        setError(
          `Too many login attempts. Please try again in about ${localAttempt.lockoutRemaining} minute${localAttempt.lockoutRemaining === 1 ? '' : 's'}.`,
        );
        return;
      }

      if (errorMessage?.trim()) {
        if (errorMessage.includes('rate limit')) {
          setError('Too many login attempts. Please try again later.');
        } else {
          setError(errorMessage);
        }
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setError('');
    setOauthLoading(true);

    try {
      await signInWithProvider(provider);
    } catch (err: unknown) {
      logger.error('OAuth sign in error:', err);
      const errorMessage = err instanceof Error ? err.message : 'OAuth sign in failed';
      setError(errorMessage);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-md-surface font-body text-md-on-surface antialiased flex items-center justify-center overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[60%] bg-md-secondary-container/20 rounded-full blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[50%] h-[70%] bg-md-on-tertiary-container/10 rounded-full blur-[150px] -z-10" />

      <main className="w-full max-w-screen-2xl flex min-h-[921px] lg:min-h-screen items-center justify-center p-6 md:p-12">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-xl shadow-2xl bg-md-surface-container-lowest">

          {/* Left Side: Editorial Content / Branding */}
          <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-16 bg-md-primary-container text-white overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-12">
                <span className="text-xl font-black tracking-tighter uppercase text-white">VALYNT</span>
              </div>
              <div className="max-w-md">
                <span className="text-xs font-semibold uppercase tracking-widest text-md-on-tertiary-container mb-4 block">
                  Economic Intelligence
                </span>
                <h2 className="text-5xl font-bold leading-tight mb-8">
                  Decipher the <br />
                  <span className="text-md-on-tertiary-container">economic value</span> of your business.
                </h2>
                <p className="text-md-on-primary-container text-lg leading-relaxed">
                  Quantify impact with our Living Value Model. Designed for boardroom confidence, not dashboards.
                </p>
              </div>
            </div>

            {/* Living Value Model Visual Concept */}
            <div className="relative z-10 flex flex-col gap-8 mt-12">
              <div className="flex items-center gap-6">
                <div className="relative flex items-center justify-center">
                  {/* Central Node */}
                  <div className="w-16 h-16 rounded-full border-2 border-md-on-tertiary-container/50 bg-md-primary-container flex items-center justify-center z-20">
                    <MaterialIcon icon="account_balance" className="text-md-on-tertiary-container" />
                  </div>
                  {/* Branching Lines (SVG) */}
                  <svg className="absolute w-[300px] h-[100px] pointer-events-none" viewBox="0 0 300 100">
                    <path className="text-md-on-tertiary-container/30" d="M64,50 C120,50 140,20 200,20" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path className="text-md-on-tertiary-container/30" d="M64,50 C120,50 140,50 200,50" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path className="text-md-on-tertiary-container/30" d="M64,50 C120,50 140,80 200,80" fill="none" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  {/* Streams */}
                  <div className="absolute left-[200px] flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-md-on-tertiary-container" />
                      <span className="text-xs font-bold uppercase tracking-widest text-md-on-primary-container">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-md-on-tertiary-container opacity-60" />
                      <span className="text-xs font-bold uppercase tracking-widest text-md-on-primary-container">Cost</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-md-on-tertiary-container opacity-30" />
                      <span className="text-xs font-bold uppercase tracking-widest text-md-on-primary-container">Risk</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-md-on-primary-container font-medium">
                Data signals unified into real-time financial outcomes.
              </p>
            </div>

            {/* Abstract Visual Decor */}
            <div className="absolute inset-0 -z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-md-primary-container via-md-primary-container to-md-tertiary-container opacity-95" />
              <div className="absolute top-0 right-0 w-full h-full opacity-10 mix-blend-overlay bg-[radial-gradient(circle_at_30%_30%,_rgba(152,99,255,0.3)_0%,_transparent_50%)]" />
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="lg:col-span-5 flex flex-col justify-center p-8 md:p-16 lg:p-20 bg-md-surface-container-lowest">
            <div className="w-full max-w-sm mx-auto">
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center gap-2 mb-12 bg-md-primary-container p-2 rounded-lg w-fit">
                <span className="text-lg font-bold text-white px-2">VALYNT</span>
              </div>

              <header className="mb-10">
                <h3 className="text-3xl font-bold text-md-primary mb-2">Welcome back</h3>
                <p className="text-md-secondary font-medium">Continue building your value case.</p>
              </header>

              {/* Error Message */}
              {error && (
                <div role="alert" className="mb-6 p-3 rounded-lg bg-md-error-container border border-md-error text-md-on-error-container text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                    Corporate Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="executive@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || oauthLoading}
                    className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all focus:border-b-2 focus:border-md-on-tertiary-container outline-none text-md-on-surface placeholder:text-md-outline"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                      Security Key
                    </label>
                    <Link to="/reset-password" className="text-xs font-semibold text-md-on-tertiary-container hover:underline transition-all">
                      Forgot key?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || oauthLoading}
                      className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all focus:border-b-2 focus:border-md-on-tertiary-container outline-none text-md-on-surface placeholder:text-md-outline pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading || oauthLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-md-outline hover:text-md-on-surface transition-colors"
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} size="sm" />
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center gap-3 py-1">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="w-4 h-4 text-md-on-tertiary-container border-md-outline-variant rounded focus:ring-0 bg-md-surface-container"
                  />
                  <label htmlFor="remember" className="text-sm font-medium text-md-secondary">
                    Secure session persistence
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || oauthLoading}
                  className="w-full bg-md-primary text-md-on-primary py-4 rounded-xl font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-md-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <MaterialIcon icon="progress_activity" className="animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Resume Value Model'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-10 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-md-outline-variant/30" />
                </div>
                <span className="relative px-4 text-xs font-bold text-md-outline bg-md-surface-container-lowest uppercase tracking-widest">
                  Enterprise Authentication
                </span>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading || oauthLoading}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-md-surface-container-low hover:bg-md-surface-container-high rounded-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-sm font-semibold text-md-primary">Google Workspace</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={loading || oauthLoading}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-md-surface-container-low hover:bg-md-surface-container-high rounded-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <MaterialIcon icon="corporate_fare" className="text-md-primary" />
                  <span className="text-sm font-semibold text-md-primary">Okta SSO</span>
                </button>
              </div>

              {/* Footer */}
              <footer className="mt-12 text-center">
                <p className="text-sm text-md-secondary font-medium">
                  New partner?{' '}
                  <Link to="/signup" className="text-md-on-tertiary-container font-bold hover:underline ml-1">
                    Request access
                  </Link>
                </p>
              </footer>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Badge for Financial Engine */}
      <motion.div
        className="fixed bottom-8 right-8 hidden md:block"
        variants={floatingBadge}
        initial="initial"
        animate="animate"
      >
        <GlassCard
          blur={12}
          opacity={0.6}
          elevation={3}
          className="p-4 flex items-center gap-4 border border-md-outline-variant/10"
        >
          <div className="w-12 h-12 rounded-lg bg-md-primary-container flex items-center justify-center overflow-hidden">
            <MaterialIcon icon="query_stats" className="text-md-on-tertiary-container text-2xl" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-md-on-tertiary-container animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-md-outline">Network Integrity</span>
            </div>
            <p className="text-xs font-bold text-md-primary">Economic Engine: Synchronized</p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
