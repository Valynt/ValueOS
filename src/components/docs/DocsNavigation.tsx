/**
 * Documentation Navigation Component
 * 
 * Sidebar navigation with role-based filtering and categorization.
 * Prioritizes non-technical content for business users.
 */

import React, { useMemo } from 'react';
import { DocCategory, DocSection, UserRole } from './types';

interface DocsNavigationProps {
  sections: DocSection[];
  selectedSection: string | null;
  onSelectSection: (sectionId: string) => void;
  userRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export const DocsNavigation: React.FC<DocsNavigationProps> = ({
  sections,
  selectedSection,
  onSelectSection,
  userRole,
  isOpen,
  onClose
}) => {
  // Group sections by category and filter by role
  const groupedSections = useMemo(() => {
    const filtered = filterSectionsByRole(sections, userRole);
    return groupByCategory(filtered);
  }, [sections, userRole]);

  // Get category order based on user role
  const categoryOrder = getCategoryOrder(userRole);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-80 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto
        `}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Documentation
            </h2>
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Role indicator */}
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Viewing as:</span> {getRoleLabel(userRole)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Content is tailored to your role
            </p>
          </div>

          {/* Navigation sections */}
          <nav className="space-y-6">
            {categoryOrder.map(category => {
              const categorySections = groupedSections[category];
              if (!categorySections || categorySections.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {getCategoryLabel(category)}
                  </h3>
                  <ul className="space-y-1">
                    {categorySections.map(section => (
                      <li key={section.id}>
                        <button
                          onClick={() => onSelectSection(section.id)}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg
                            transition-colors duration-150
                            ${selectedSection === section.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className="flex items-start gap-2">
                            {section.icon && (
                              <span className="text-lg mt-0.5">{section.icon}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {section.title}
                              </div>
                              {section.description && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {section.description}
                                </div>
                              )}
                              {section.estimatedTime && (
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {section.estimatedTime}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>

          {/* Quick links */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="/support"
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Contact Support
                </a>
              </li>
              <li>
                <a
                  href="/changelog"
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  What's New
                </a>
              </li>
              <li>
                <a
                  href="/community"
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Community
                </a>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
};

// Helper functions

function filterSectionsByRole(sections: DocSection[], role: UserRole): DocSection[] {
  return sections.filter(section => {
    // If section has audience specified, check if role matches
    if (section.audience && section.audience.length > 0) {
      return section.audience.includes(role);
    }

    // Default filtering based on category
    switch (role) {
      case 'business':
      case 'executive':
        // Show overview and basic user guide
        return section.category === 'overview' || 
               (section.category === 'user-guide' && !section.id.includes('sso'));
      
      case 'admin':
        // Show everything except developer-specific content
        return section.category !== 'api-reference';
      
      case 'developer':
        // Show everything
        return true;
      
      case 'member':
        // Show overview and basic guides
        return section.category === 'overview' || section.category === 'user-guide';
      
      case 'viewer':
        // Show only overview
        return section.category === 'overview';
      
      default:
        return section.category === 'overview';
    }
  });
}

function groupByCategory(sections: DocSection[]): Record<DocCategory, DocSection[]> {
  const grouped: Record<string, DocSection[]> = {
    'overview': [],
    'user-guide': [],
    'developer-guide': [],
    'api-reference': []
  };

  sections.forEach(section => {
    if (!grouped[section.category]) {
      grouped[section.category] = [];
    }
    grouped[section.category].push(section);
  });

  return grouped as Record<DocCategory, DocSection[]>;
}

function getCategoryOrder(role: UserRole): DocCategory[] {
  switch (role) {
    case 'business':
    case 'executive':
      return ['overview', 'user-guide'];
    
    case 'admin':
      return ['user-guide', 'overview', 'developer-guide'];
    
    case 'developer':
      return ['developer-guide', 'api-reference', 'user-guide', 'overview'];
    
    case 'member':
      return ['user-guide', 'overview'];
    
    case 'viewer':
      return ['overview'];
    
    default:
      return ['overview', 'user-guide', 'developer-guide', 'api-reference'];
  }
}

function getCategoryLabel(category: DocCategory): string {
  const labels: Record<DocCategory, string> = {
    'overview': 'Getting Started',
    'user-guide': 'User Guides',
    'developer-guide': 'For Developers',
    'api-reference': 'API Reference'
  };
  return labels[category];
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    'business': 'Business User',
    'executive': 'Executive',
    'admin': 'Administrator',
    'member': 'Team Member',
    'developer': 'Developer',
    'viewer': 'Viewer'
  };
  return labels[role];
}

export default DocsNavigation;
