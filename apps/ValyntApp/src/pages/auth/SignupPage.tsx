import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Logo } from "@/components/marketing/Logo";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signUp(email, password, fullName);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      // TODO: Implement actual Google OAuth
      console.log("Google sign in initiated");
      // For now, simulate successful signup
      await signUp("demo@valynt.com", "password", "Demo User");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Google sign in failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = async () => {
    setLoading(true);
    setError("");

    try {
      // Bypass authentication for development
      await signUp("dev@valynt.com", "bypass", "Dev User");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Bypass failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* SVG Gradient Definition */}
      <svg className="hidden">
        <defs>
          <linearGradient
            id="signup-logo"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#5A5D67" />
          </linearGradient>
        </defs>
      </svg>

      <div className="w-full max-w-md space-y-8">
        {/* Header with Logo */}
        <div className="text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 flex items-center justify-center">
              <Logo gradientId="signup-logo" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Join Valynt</h1>
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="text-teal-500 hover:text-teal-400">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-md bg-red-900/50 border border-red-800 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium text-gray-300">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="flex h-11 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm placeholder:text-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="flex h-11 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm placeholder:text-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="flex h-11 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm placeholder:text-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center w-full h-11 px-4 rounded-md bg-teal-500 text-black font-semibold hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-black disabled:pointer-events-none disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Valynt Account"
            )}
          </button>

          {/* Google Login Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="inline-flex items-center justify-center w-full h-11 px-4 rounded-md border border-gray-700 bg-gray-900/50 text-white font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-black disabled:pointer-events-none disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Bypass Button */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleBypass}
              className="inline-flex items-center justify-center w-full h-11 px-4 rounded-md border border-yellow-600 bg-yellow-900/20 text-yellow-400 font-medium hover:bg-yellow-900/30 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black transition-colors text-xs"
            >
              ⚡ Bypass Signup
            </button>
          )}
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="text-teal-500 hover:text-teal-400">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-teal-500 hover:text-teal-400">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
