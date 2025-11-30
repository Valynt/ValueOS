/**
 * Mobile Navigation Component
 * Responsive navigation for mobile devices
 */

import React, { useState } from 'react';
import { Menu, X, Home, FileText, Settings, HelpCircle, User, LogOut } from 'lucide-react';

interface MobileNavProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
  userName?: string;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentPage = 'home',
  onNavigate,
  onLogout,
  userName = 'User',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'cases', label: 'Cases', icon: <FileText className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
    { id: 'help', label: 'Help', icon: <HelpCircle className="w-5 h-5" /> },
  ];

  const handleNavigate = (page: string) => {
    setIsOpen(false);
    onNavigate?.(page);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">ValueCanvas</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors tap-target"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50 animate-fade-in"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Drawer */}
      <nav
        className={`
          md:hidden fixed top-0 right-0 bottom-0 z-40 w-80 max-w-[85vw]
          bg-white shadow-2xl transform transition-transform duration-300 ease-out
          safe-area-top safe-area-bottom
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Mobile navigation"
      >
        <div className="flex flex-col h-full">
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-gray-500">Account</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigate(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-colors tap-target
                      ${
                        currentPage === item.id
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                    aria-current={currentPage === item.id ? 'page' : undefined}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Menu Footer */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors tap-target"
              aria-label="Log out"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Log Out</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

/**
 * Mobile Bottom Navigation
 * Alternative navigation pattern for mobile
 */
interface MobileBottomNavProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage = 'home',
  onNavigate,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: <Home className="w-6 h-6" /> },
    { id: 'cases', label: 'Cases', icon: <FileText className="w-6 h-6" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-6 h-6" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-6 h-6" /> },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-bottom"
      aria-label="Bottom navigation"
    >
      <ul className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <li key={item.id} className="flex-1">
            <button
              onClick={() => onNavigate?.(item.id)}
              className={`
                w-full flex flex-col items-center gap-1 py-2 px-3 rounded-lg
                transition-colors tap-target
                ${
                  currentPage === item.id
                    ? 'text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }
              `}
              aria-current={currentPage === item.id ? 'page' : undefined}
              aria-label={item.label}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
