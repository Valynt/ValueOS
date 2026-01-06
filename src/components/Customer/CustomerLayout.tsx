/**
 * Customer Layout Component
 * Customer-facing layout without internal navigation
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface CustomerLayoutProps {
  children: React.ReactNode;
  companyName?: string;
  companyLogo?: string;
  loading?: boolean;
  error?: string | null;
}

export function CustomerLayout({
  children,
  companyName,
  companyLogo,
  loading = false,
  error = null
}: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Customer Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Company Branding */}
            <div className="flex items-center space-x-4">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={`${companyName} logo`}
                  className="h-8 w-auto"
                />
              ) : (
                <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {companyName?.charAt(0) || 'V'}
                  </span>
                </div>
              )}
              
              {companyName && (
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold text-gray-900">
                    {companyName}
                  </h1>
                  <p className="text-xs text-gray-500">
                    Value Realization Portal
                  </p>
                </div>
              )}
            </div>

            {/* Powered By */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Powered by</span>
              <span className="font-semibold text-blue-600">ValueOS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} ValueOS. All rights reserved.
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <a
                href="https://valueos.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="https://valueos.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="https://valueos.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Loading State Component
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      <p className="text-gray-600 text-lg">Loading your value metrics...</p>
    </div>
  );
}

/**
 * Error State Component
 */
function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Unable to Load Portal
            </h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <p className="mt-3 text-sm text-red-600">
              Please contact your account manager if this issue persists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile-responsive container
 */
export function CustomerContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}

/**
 * Section header for customer portal
 */
export function CustomerSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="px-6 py-4">
        {children}
      </div>
    </section>
  );
}
