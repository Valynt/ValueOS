/**
 * Modern Signup Page - Split Layout Design
 *
 * Matching login design with signup-specific fields.
 * - Left panel: Branding + Economic Intelligence tagline
 * - Right panel: Signup form with company onboarding
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { GlassCard } from '@/components/ui/GlassCard';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { floatingBadge } from '@/lib/animations';
import { cn } from '@/lib/utils';

export function ModernSignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the terms of service');
      return;
    }

    setLoading(true);

    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          company: formData.company,
        },
      });

      logger.info('[SignupPage] Signup successful');
      navigate('/onboarding');
    } catch (err: unknown) {
      logger.error('[SignupPage] Signup error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    formData.firstName?.trim() &&
    formData.lastName?.trim() &&
    formData.email?.trim() &&
    formData.company?.trim() &&
    formData.password &&
    formData.confirmPassword &&
    agreedToTerms;

  return (
    <div className="min-h-screen bg-md-surface font-body text-md-on-surface antialiased flex items-center justify-center overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[60%] bg-md-secondary-container/20 rounded-full blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[50%] h-[70%] bg-md-on-tertiary-container/10 rounded-full blur-[150px] -z-10" />

      <main className="w-full max-w-screen-2xl flex min-h-screen items-center justify-center p-6 md:p-12">
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
                  Join the <br />
                  <span className="text-md-on-tertiary-container">value revolution</span>.
                </h2>
                <p className="text-md-on-primary-container text-lg leading-relaxed">
                  Start quantifying your business impact with boardroom-ready insights.
                  Join leading enterprises already using our Living Value Model.
                </p>
              </div>
            </div>

            {/* Stats Section */}
            <div className="relative z-10 mt-12">
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <p className="text-3xl font-bold text-white">$2.4B</p>
                  <p className="text-sm text-md-on-primary-container mt-1">Value Realized</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">500+</p>
                  <p className="text-sm text-md-on-primary-container mt-1">Enterprise Clients</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">98%</p>
                  <p className="text-sm text-md-on-primary-container mt-1">CFO Approval</p>
                </div>
              </div>
            </div>

            {/* Abstract Visual Decor */}
            <div className="absolute inset-0 -z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-md-primary-container via-md-primary-container to-md-tertiary-container opacity-95" />
              <div className="absolute top-0 right-0 w-full h-full opacity-10 mix-blend-overlay bg-[radial-gradient(circle_at_70%_70%,_rgba(152,99,255,0.3)_0%,_transparent_50%)]" />
            </div>
          </div>

          {/* Right Side: Signup Form */}
          <div className="lg:col-span-5 flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-md-surface-container-lowest overflow-y-auto max-h-screen">
            <div className="w-full max-w-sm mx-auto">
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center gap-2 mb-8 bg-md-primary-container p-2 rounded-lg w-fit">
                <span className="text-lg font-bold text-white px-2">VALYNT</span>
              </div>

              <header className="mb-8">
                <h3 className="text-3xl font-bold text-md-primary mb-2">Request Access</h3>
                <p className="text-md-secondary font-medium">
                  Join enterprises quantifying their economic impact.
                </p>
              </header>

              {/* Error Message */}
              {error && (
                <div role="alert" className="mb-6 p-3 rounded-lg bg-md-error-container border border-md-error text-md-on-error-container text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      placeholder="Smith"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline"
                    />
                  </div>
                </div>

                {/* Email */}
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
                    placeholder="john.smith@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline"
                  />
                </div>

                {/* Company */}
                <div className="space-y-2">
                  <label htmlFor="company" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                    Company
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    placeholder="Acme Corporation"
                    value={formData.company}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-md-outline hover:text-md-on-surface transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} size="sm" />
                    </button>
                  </div>
                  <p className="text-[10px] text-md-outline">Minimum 8 characters</p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-md-outline">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-md-surface-container-high border-none rounded-lg focus:ring-0 focus:bg-md-surface-container-highest transition-all outline-none text-md-on-surface placeholder:text-md-outline"
                  />
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 py-2">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 mt-0.5 text-md-on-tertiary-container border-md-outline-variant rounded focus:ring-0 bg-md-surface-container"
                  />
                  <label htmlFor="terms" className="text-sm text-md-secondary leading-relaxed">
                    I agree to the{' '}
                    <Link to="/terms" className="text-md-on-tertiary-container hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-md-on-tertiary-container hover:underline">Privacy Policy</Link>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg",
                    isFormValid
                      ? "bg-md-primary text-md-on-primary hover:opacity-90 active:scale-[0.98] shadow-md-primary/10"
                      : "bg-md-surface-container-high text-md-outline cursor-not-allowed"
                  )}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <MaterialIcon icon="progress_activity" className="animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Request Access'
                  )}
                </button>
              </form>

              {/* Footer */}
              <footer className="mt-8 text-center">
                <p className="text-sm text-md-secondary font-medium">
                  Already have access?{' '}
                  <Link to="/login" className="text-md-on-tertiary-container font-bold hover:underline ml-1">
                    Sign in
                  </Link>
                </p>
              </footer>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Badge */}
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
            <MaterialIcon icon="shield" className="text-md-on-tertiary-container text-2xl" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-md-outline">Enterprise Grade</span>
            </div>
            <p className="text-xs font-bold text-md-primary">SOC 2 Type II Certified</p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
