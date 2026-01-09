/**
 * Floating Help Button Component
 * 
 * Provides quick access to documentation from anywhere in the app.
 * Shows contextual help based on current page.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, HelpCircle, X } from 'lucide-react';

interface DocsHelpButtonProps {
  /** Optional specific section to link to */
  sectionId?: string;
  /** Position of the button */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const DocsHelpButton: React.FC<DocsHelpButtonProps> = ({
  sectionId,
  position = 'bottom-right'
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get contextual help based on current route
  const getContextualHelp = () => {
    const path = location.pathname;
    
    if (path.includes('/canvas')) {
      return {
        title: 'Value Canvas Help',
        sectionId: 'user-guide-getting-started',
        description: 'Learn how to map problems to solutions'
      };
    } else if (path.includes('/cascade')) {
      return {
        title: 'Impact Cascade Help',
        sectionId: 'user-guide-getting-started',
        description: 'Connect drivers to KPIs'
      };
    } else if (path.includes('/calculator')) {
      return {
        title: 'ROI Calculator Help',
        sectionId: 'user-guide-getting-started',
        description: 'Model financial ROI'
      };
    } else if (path.includes('/dashboard')) {
      return {
        title: 'Dashboard Help',
        sectionId: 'user-guide-getting-started',
        description: 'Track actual value'
      };
    }
    
    return {
      title: 'Getting Started',
      sectionId: 'overview-welcome',
      description: 'Learn the basics of ValueOS'
    };
  };

  const contextualHelp = getContextualHelp();

  const handleOpenDocs = (targetSectionId?: string) => {
    const section = targetSectionId || sectionId || contextualHelp.sectionId;
    navigate(`/docs/${section}`);
    setShowMenu(false);
  };

  const handleOpenDocsHome = () => {
    navigate('/docs');
    setShowMenu(false);
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  return (
    <>
      {/* Help Menu */}
      {showMenu && (
        <div
          className={`fixed ${positionClasses[position]} mb-20 z-40 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-100 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Need Help?
                </h3>
              </div>
              <button
                onClick={() => setShowMenu(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close help menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Contextual Help */}
            <button
              onClick={() => handleOpenDocs()}
              className="w-full text-left p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
            >
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {contextualHelp.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {contextualHelp.description}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </button>

            {/* Quick Links */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                Quick Links
              </div>
              
              <button
                onClick={handleOpenDocsHome}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                📚 Browse All Documentation
              </button>
              
              <button
                onClick={() => handleOpenDocs('user-guide-getting-started')}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                🚀 Getting Started Guide
              </button>
              
              <button
                onClick={() => handleOpenDocs('user-guide-user-management')}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                👥 User Management
              </button>
              
              <button
                onClick={() => handleOpenDocs('dev-guide-quick-start')}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
              >
                💻 Developer Guide
              </button>
            </div>

            {/* Support Link */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <a
                href="/support"
                className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`fixed ${positionClasses[position]} z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group`}
        aria-label="Open help menu"
        title="Need help? Click for documentation"
      >
        {showMenu ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <HelpCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </>
        )}
      </button>
    </>
  );
};

export default DocsHelpButton;
