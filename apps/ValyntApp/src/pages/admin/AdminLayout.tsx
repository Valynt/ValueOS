import React, { useCallback, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { ScopeBadge } from '../../components/admin/ScopeBadge';
import {
  type AdminNavSection,
  type AdminPermission,
  buildBreadcrumbs,
  filterByPermissions,
  findNavItemByPath,
  searchNavItems,
} from '../../lib/adminNavigation';

import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  /**
   * Permissions for the current user.
   * In production, this comes from the auth context.
   */
  permissions?: Set<AdminPermission>;
  /**
   * Current plan tier for feature gating.
   */
  planTier?: 'free' | 'basic' | 'pro' | 'enterprise';
}

/**
 * Admin control plane layout.
 *
 * Left rail navigation with scope-aware sections.
 * Replaces the flat tab-based SettingsLayout for org-level and platform-level settings.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  permissions = new Set<AdminPermission>([
    'governance.read', 'governance.write',
    'identity.read', 'identity.write',
    'security.read', 'security.write',
    'agents.read', 'agents.write',
    'data.read', 'data.write',
    'compliance.read', 'compliance.write',
    'billing.read', 'billing.write',
  ]),
  planTier = 'pro',
}) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const filteredSections = useMemo(
    () => filterByPermissions(permissions, planTier),
    [permissions, planTier]
  );

  const currentItem = useMemo(
    () => findNavItemByPath(location.pathname),
    [location.pathname]
  );

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location.pathname),
    [location.pathname]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchNavItems(searchQuery, permissions);
  }, [searchQuery, permissions]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Left Rail */}
      <nav
        className="w-64 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto"
        aria-label="Admin navigation"
      >
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Jump to setting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Search admin settings"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <ul className="mt-2 border border-gray-200 rounded-md bg-white shadow-sm max-h-60 overflow-y-auto" role="listbox">
              {searchResults.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    onClick={() => setSearchQuery('')}
                    className="block px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{item.label}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{item.description}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section Navigation */}
        <div className="py-2">
          {filteredSections.map((section: AdminNavSection) => (
            <div key={section.id} role="group" aria-label={section.label}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50"
                aria-expanded={!collapsedSections.has(section.id)}
              >
                <span>{section.label}</span>
                <svg
                  className={cn(
                    'w-3 h-3 transition-transform',
                    collapsedSections.has(section.id) ? '-rotate-90' : ''
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!collapsedSections.has(section.id) && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          )
                        }
                      >
                        <span className="truncate">{item.label}</span>
                        {item.sensitivity === 'destructive' && (
                          <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Destructive action">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                          </svg>
                        )}
                        {item.minPlanTier && (
                          <span className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">
                            {item.minPlanTier}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Breadcrumbs + Scope Badge */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                <NavLink to="/admin" className="hover:text-gray-700">Admin</NavLink>
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={crumb.path}>
                    <span aria-hidden="true">/</span>
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-gray-900 font-medium">{crumb.label}</span>
                    ) : (
                      <NavLink to={crumb.path} className="hover:text-gray-700">{crumb.label}</NavLink>
                    )}
                  </React.Fragment>
                ))}
              </nav>

              {/* Page Title */}
              <h1 className="text-xl font-semibold text-gray-900">
                {currentItem?.label ?? 'Admin'}
              </h1>
              {currentItem?.description && (
                <p className="text-sm text-gray-500 mt-0.5">{currentItem.description}</p>
              )}
            </div>

            {/* Scope Badge */}
            {currentItem && <ScopeBadge scope={currentItem.scope} />}
          </div>
        </div>

        {/* Page Content */}
        <div className="px-8 py-6 max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
