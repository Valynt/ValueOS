/**
 * Complete Integration Example
 * 
 * Shows how to integrate all documentation components into ValueOS.
 */

import React from 'react';
import { DocsHelpButton } from '../DocsHelpButton';
import { DocsHeaderLink } from '../DocsHeaderLink';
import { DocsQuickAccessWidget } from '../DocsQuickAccessWidget';

// ============================================================================
// Example 1: Add Help Button to Main Layout
// ============================================================================

export function MainLayoutWithHelp() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Your existing layout */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <h1>ValueOS</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Your content */}
      </main>

      {/* Add floating help button */}
      <DocsHelpButton position="bottom-right" />
    </div>
  );
}

// ============================================================================
// Example 2: Add Documentation Link to Header
// ============================================================================

export function HeaderWithDocsLink() {
  return (
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold">ValueOS</h1>
          <nav className="flex items-center gap-4">
            <a href="/dashboard">Dashboard</a>
            <a href="/canvas">Canvas</a>
            <a href="/settings">Settings</a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Add documentation link */}
          <DocsHeaderLink />
          
          {/* Other header items */}
          <button>Notifications</button>
          <button>Profile</button>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Example 3: Add Quick Access Widget to Dashboard
// ============================================================================

export function DashboardWithDocsWidget() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Your existing dashboard widgets */}
        <div className="bg-white rounded-lg p-6">
          <h2>Metrics</h2>
          {/* Metrics content */}
        </div>

        <div className="bg-white rounded-lg p-6">
          <h2>Activity</h2>
          {/* Activity content */}
        </div>

        {/* Add documentation widget */}
        <DocsQuickAccessWidget />
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Contextual Help on Specific Pages
// ============================================================================

export function ValueCanvasWithContextualHelp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Value Canvas</h1>
          
          {/* Contextual help for this specific page */}
          <DocsHeaderLink />
        </div>
      </header>

      <main className="p-8">
        {/* Canvas content */}
      </main>

      {/* Floating help button with specific section */}
      <DocsHelpButton sectionId="user-guide-getting-started" />
    </div>
  );
}

// ============================================================================
// Example 5: Inline Documentation Links
// ============================================================================

export function FeatureWithInlineHelp() {
  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">SSO Configuration</h2>
        <a
          href="/docs/user-guide-sso"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <span>View Guide</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Feature content */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Identity Provider
          </label>
          <select className="w-full border rounded-lg px-3 py-2">
            <option>Okta</option>
            <option>Azure AD</option>
            <option>Google Workspace</option>
          </select>
        </div>

        {/* Help callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Need help?</strong> Check out our{' '}
            <a href="/docs/user-guide-sso" className="underline font-medium">
              SSO setup guide
            </a>
            {' '}for step-by-step instructions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Empty State with Documentation Link
// ============================================================================

export function EmptyStateWithDocs() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No data yet
        </h3>
        <p className="text-gray-600 mb-6">
          Get started by creating your first value canvas.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Canvas
          </button>
          <a
            href="/docs/user-guide-getting-started"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            View Guide
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 7: Error State with Documentation Link
// ============================================================================

export function ErrorStateWithDocs() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Something went wrong
        </h3>
        <p className="text-gray-600 mb-6">
          We couldn't load your data. Please try again or check our documentation for help.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Try Again
          </button>
          <a
            href="/docs"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Get Help
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 8: Settings Page with Documentation Sections
// ============================================================================

export function SettingsWithDocs() {
  const settingsSections = [
    {
      title: 'User Management',
      description: 'Manage team members and permissions',
      docLink: '/docs/user-guide-user-management'
    },
    {
      title: 'SSO Configuration',
      description: 'Set up enterprise authentication',
      docLink: '/docs/user-guide-sso'
    },
    {
      title: 'Billing',
      description: 'Manage subscription and payments',
      docLink: '/docs/user-guide-billing'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-4">
        {settingsSections.map((section) => (
          <div key={section.title} className="bg-white rounded-lg p-6 border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">{section.title}</h3>
                <p className="text-gray-600">{section.description}</p>
              </div>
              <a
                href={section.docLink}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0 ml-4"
              >
                <span>View Guide</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  MainLayoutWithHelp,
  HeaderWithDocsLink,
  DashboardWithDocsWidget,
  ValueCanvasWithContextualHelp,
  FeatureWithInlineHelp,
  EmptyStateWithDocs,
  ErrorStateWithDocs,
  SettingsWithDocs
};
