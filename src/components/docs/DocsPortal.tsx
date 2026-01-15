/**
 * Documentation Portal Component
 * 
 * Main entry point for in-product documentation.
 * Provides role-aware, searchable documentation for all user types.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { DocsNavigation } from './DocsNavigation';
import { DocsViewer } from './DocsViewer';
import { DocsSearch } from './DocsSearch';
import { DocsHeader } from './DocsHeader';
import { DocsAdminDashboard } from './DocsAdminDashboard';
import { useDocumentation } from '../../hooks/useDocumentation';
import type { DocSection, UserRole } from './types';

interface DocsPortalProps {
  initialSection?: string;
  role?: UserRole;
}

export const DocsPortal: React.FC<DocsPortalProps> = ({ 
  initialSection,
  role: propRole 
}) => {
  const { user } = useAuth();
  const [selectedSection, setSelectedSection] = useState<string | null>(initialSection || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine user role for content filtering
  const userRole: UserRole = propRole || (user?.role as UserRole) || 'business';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const {
    sections,
    currentSection,
    loading,
    error,
    searchResults,
    fetchSection,
    searchDocs
  } = useDocumentation();

  // Load initial section
  useEffect(() => {
    if (initialSection) {
      fetchSection(initialSection);
    } else {
      // Default to role-appropriate landing page
      const defaultSection = getDefaultSection(userRole);
      fetchSection(defaultSection);
    }
  }, [initialSection, userRole]);

  // Handle search
  useEffect(() => {
    if (searchQuery.length > 2) {
      searchDocs(searchQuery, userRole);
    }
  }, [searchQuery, userRole]);

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSection(sectionId);
    fetchSection(sectionId);
    setMobileMenuOpen(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (loading && !currentSection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Unable to Load Documentation
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <DocsHeader
        onSearch={handleSearch}
        searchQuery={searchQuery}
        userRole={userRole}
        isAdmin={isAdmin}
        onToggleAdminDashboard={() => setShowAdminDashboard(!showAdminDashboard)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        showAdminDashboard={showAdminDashboard}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <DocsNavigation
          sections={sections}
          selectedSection={selectedSection}
          onSelectSection={handleSectionSelect}
          userRole={userRole}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {showAdminDashboard && isAdmin ? (
            <DocsAdminDashboard />
          ) : searchQuery.length > 2 ? (
            <DocsSearch
              query={searchQuery}
              results={searchResults}
              onSelectResult={handleSectionSelect}
              userRole={userRole}
            />
          ) : (
            <DocsViewer
              section={currentSection}
              userRole={userRole}
              onNavigate={handleSectionSelect}
            />
          )}
        </main>
      </div>
    </div>
  );
};

// Helper function to determine default section based on role
function getDefaultSection(role: UserRole): string {
  switch (role) {
    case 'business':
    case 'executive':
      return 'overview-welcome';
    case 'admin':
      return 'user-guide-getting-started';
    case 'developer':
      return 'dev-guide-quick-start';
    default:
      return 'overview-welcome';
  }
}

export default DocsPortal;
