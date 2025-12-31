import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsBreadcrumb } from './SettingsBreadcrumb';
import { GlobalSearch } from './GlobalSearch';
import { useSettings } from '../../contexts/SettingsContext';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { setCurrentRoute } = useSettings();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside
        className="hidden lg:block w-72 border-r border-gray-200 bg-white"
        role="complementary"
        aria-label="Settings navigation"
      >
        <SettingsSidebar />
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-full">
            <SettingsSidebar
              isMobile
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <main
        className="flex-1 overflow-y-auto"
        role="main"
        aria-label="Settings content"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:hidden mb-4 flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open settings menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-6 w-6 text-gray-700" aria-hidden="true" />
            </button>
            <div className="flex-1">
              <GlobalSearch onNavigate={setCurrentRoute} />
            </div>
          </div>

          <div className="hidden lg:block mb-6">
            <GlobalSearch onNavigate={setCurrentRoute} />
          </div>

          <SettingsBreadcrumb />

          <div className="space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
