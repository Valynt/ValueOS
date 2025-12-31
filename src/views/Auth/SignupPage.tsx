/**
 * Signup Page - VALYNT Dark Theme
 * New user registration with password validation
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle, CheckCircle, Lock, Mail, User } from "lucide-react";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Password strength validation
  const passwordChecks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const isPasswordValid = passwordStrength === 5;
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await signup({ email, password, fullName });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Signup error:", err);

      if (err.message?.includes("breach")) {
        setError(
          "This password has been found in a data breach. Please choose a different password."
        );
      } else if (err.message?.includes("rate limit")) {
        setError("Too many signup attempts. Please try again later.");
      } else {
        setError(err.message || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vc-surface-1 text-white font-sans selection:bg-emerald-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[480px] z-10 p-6">
        <div className="bg-vc-surface-2 rounded-[32px] border border-white/5 shadow-2xl overflow-hidden relative">
          {/* Top/Bottom accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-20 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

          <div className="p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">
                Join VALYNT
              </h1>
              <p className="text-gray-400 text-sm">
                Create your account to get started
              </p>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Alert */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                    placeholder="you@studio.dev"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                </div>

                {/* Password Requirements */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-1.5 bg-vc-surface-3/50 rounded-lg p-3 border border-white/5">
                    <div className="text-xs font-medium text-gray-400 mb-2">
                      Password Requirements:
                    </div>
                    {[
                      { key: "length", label: "At least 12 characters" },
                      { key: "uppercase", label: "One uppercase letter" },
                      { key: "lowercase", label: "One lowercase letter" },
                      { key: "number", label: "One number" },
                      { key: "special", label: "One special character" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center text-xs">
                        {passwordChecks[key as keyof typeof passwordChecks] ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2 flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-600 mr-2 flex-shrink-0" />
                        )}
                        <span
                          className={
                            passwordChecks[key as keyof typeof passwordChecks]
                              ? "text-emerald-400"
                              : "text-gray-500"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-vc-surface-3 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                    placeholder="Confirm your password"
                    disabled={loading}
                  />
                </div>
                {confirmPassword.length > 0 && (
                  <div className="mt-2 flex items-center text-xs">
                    {passwordsMatch ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2" />
                        <span className="text-emerald-400">
                          Passwords match
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 mr-2" />
                        <span className="text-red-400">
                          Passwords do not match
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className={`
                  w-full py-3.5 px-4 rounded-xl font-semibold text-sm
                  ${
                    loading || !isPasswordValid || !passwordsMatch
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                  }
                  transition-all duration-200 relative overflow-hidden group
                `}
              >
                {!loading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                )}
                <span className="relative z-10">
                  {loading ? "Creating account..." : "Create Account"}
                </span>
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-600">
              Your password is checked against known breaches for security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
