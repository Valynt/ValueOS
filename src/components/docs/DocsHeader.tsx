/**
 * Documentation Header Component
 */

import React from 'react';
import { UserRole } from './types';

interface DocsHeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  userRole: UserRole;
  isAdmin: boolean;
  onToggleAdminDashboard: () => void;
  onToggleMobileMenu: () => void;
  showAdminDashboard: boolean;
}

export const DocsHeader: React.FC<DocsHeaderProps> = ({
  onSearch,
  searchQuery,
  userRole,
  isAdmin,
  onToggleAdminDashboard,
  onToggleMobileMenu,
  showAdminDashboard
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search bar */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <input
              type="search"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Admin dashboard toggle */}
        {isAdmin && (
          <button
            onClick={onToggleAdminDashboard}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              showAdminDashboard
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Admin Dashboard
          </button>
        )}
      </div>
    </header>
  );
};

export default DocsHeader;
