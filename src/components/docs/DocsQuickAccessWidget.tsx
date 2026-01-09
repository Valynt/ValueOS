/**
 * Documentation Quick Access Widget
 * 
 * Dashboard widget showing popular documentation and quick links.
 * Perfect for home/dashboard pages.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';

interface DocLink {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime?: string;
}

const popularDocs: DocLink[] = [
  {
    id: 'user-guide-getting-started',
    title: 'Getting Started',
    description: 'Set up your account in 30 minutes',
    icon: '🚀',
    estimatedTime: '30 min'
  },
  {
    id: 'user-guide-user-management',
    title: 'User Management',
    description: 'Manage team members and permissions',
    icon: '👥',
    estimatedTime: '15 min'
  },
  {
    id: 'user-guide-sso',
    title: 'SSO Setup',
    description: 'Configure enterprise authentication',
    icon: '🔐',
    estimatedTime: '20 min'
  },
  {
    id: 'overview-use-cases',
    title: 'Use Cases',
    description: 'See how others use ValueOS',
    icon: '💡',
    estimatedTime: '10 min'
  }
];

export const DocsQuickAccessWidget: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Documentation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Learn how to get the most out of ValueOS
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/docs')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Popular Docs */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Popular Guides
          </h4>
        </div>

        <div className="space-y-2">
          {popularDocs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/docs/${doc.id}`)}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{doc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {doc.title}
                    </h5>
                    {doc.estimatedTime && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {doc.estimatedTime}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {doc.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/docs')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Browse All Docs
            </button>
            <button
              onClick={() => navigate('/support')}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsQuickAccessWidget;
