/**
 * Example: Documentation Route Integration
 * 
 * Shows how to integrate the documentation portal into your app routing.
 */

import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DocsPortal } from '../DocsPortal';
import { useAuth } from '../../../app/providers/AuthContext';

// Example: Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Example: Documentation page with URL parameter
function DocsPage() {
  const { sectionId } = useParams<{ sectionId?: string }>();
  const { user } = useAuth();
  
  return (
    <DocsPortal 
      initialSection={sectionId}
      role={user?.role}
    />
  );
}

// Example: Main app routes
export function AppRoutesExample() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<div>Login Page</div>} />
      
      {/* Protected documentation routes */}
      <Route 
        path="/docs" 
        element={
          <ProtectedRoute>
            <DocsPage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/docs/:sectionId" 
        element={
          <ProtectedRoute>
            <DocsPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Other protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// Example: Documentation link in navigation
export function NavigationExample() {
  return (
    <nav className="flex flex-col gap-2 p-4">
      <a href="/dashboard" className="px-4 py-2 hover:bg-gray-100 rounded">
        Dashboard
      </a>
      <a href="/settings" className="px-4 py-2 hover:bg-gray-100 rounded">
        Settings
      </a>
      <a href="/docs" className="px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Documentation
      </a>
    </nav>
  );
}

// Example: Contextual help button
export function HelpButtonExample() {
  const [showHelp, setShowHelp] = React.useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center text-xl font-bold"
        aria-label="Help"
      >
        ?
      </button>
      
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Need Help?</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Browse our documentation or contact support for assistance.
            </p>
            <div className="flex gap-2">
              <a
                href="/docs"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
              >
                View Docs
              </a>
              <a
                href="/support"
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Example: Inline documentation link
export function InlineDocLinkExample() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-800">
        💡 <strong>Tip:</strong> Learn more about{' '}
        <a 
          href="/docs/user-guide-sso" 
          className="underline hover:text-blue-900"
        >
          setting up SSO
        </a>
        {' '}in our documentation.
      </p>
    </div>
  );
}

// Example: Documentation widget in dashboard
export function DocsWidgetExample() {
  const popularDocs = [
    { id: 'user-guide-getting-started', title: 'Getting Started', icon: '🚀' },
    { id: 'user-guide-user-management', title: 'User Management', icon: '👥' },
    { id: 'user-guide-billing', title: 'Billing', icon: '💳' },
  ];
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Popular Documentation
      </h3>
      <div className="space-y-2">
        {popularDocs.map(doc => (
          <a
            key={doc.id}
            href={`/docs/${doc.id}`}
            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="text-2xl">{doc.icon}</span>
            <span className="text-gray-700 hover:text-blue-600">{doc.title}</span>
            <svg className="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </div>
      <a
        href="/docs"
        className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-700"
      >
        View all documentation →
      </a>
    </div>
  );
}

export default AppRoutesExample;
