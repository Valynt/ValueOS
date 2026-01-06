/**
 * Contextual Help Component
 * 
 * Displays inline help links and tips based on the current context.
 * Can be placed anywhere in the app to provide contextual documentation.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

interface DocsContextualHelpProps {
  /** Section ID to link to */
  sectionId: string;
  /** Title of the help section */
  title: string;
  /** Brief description */
  description?: string;
  /** Display variant */
  variant?: 'inline' | 'banner' | 'card';
  /** Show icon */
  showIcon?: boolean;
}

export const DocsContextualHelp: React.FC<DocsContextualHelpProps> = ({
  sectionId,
  title,
  description,
  variant = 'inline',
  showIcon = true
}) => {
  const navigate = useNavigate();

  if (variant === 'banner') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          {showIcon && (
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              {title}
            </h4>
            {description && (
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                {description}
              </p>
            )}
            <button
              onClick={() => navigate(`/docs/${sectionId}`)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              View Documentation
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
        <button
          onClick={() => navigate(`/docs/${sectionId}`)}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3">
            {showIcon && (
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                {title}
              </h4>
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <button
      onClick={() => navigate(`/docs/${sectionId}`)}
      className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
    >
      {showIcon && <BookOpen className="w-4 h-4" />}
      <span>{title}</span>
      <ExternalLink className="w-3 h-3" />
    </button>
  );
};

/**
 * Quick Help Tip Component
 * Small inline tip with link to documentation
 */
interface QuickHelpTipProps {
  sectionId: string;
  text: string;
}

export const QuickHelpTip: React.FC<QuickHelpTipProps> = ({ sectionId, text }) => {
  const navigate = useNavigate();

  return (
    <div className="text-sm text-gray-600 dark:text-gray-400">
      💡 <strong>Tip:</strong> {text}{' '}
      <button
        onClick={() => navigate(`/docs/${sectionId}`)}
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        Learn more
      </button>
    </div>
  );
};

/**
 * Empty State with Documentation Link
 */
interface EmptyStateWithDocsProps {
  title: string;
  description: string;
  sectionId: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyStateWithDocs: React.FC<EmptyStateWithDocsProps> = ({
  title,
  description,
  sectionId,
  actionLabel = 'Get Started',
  onAction
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {description}
        </p>
        <div className="flex gap-3 justify-center">
          {onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {actionLabel}
            </button>
          )}
          <button
            onClick={() => navigate(`/docs/${sectionId}`)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            View Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocsContextualHelp;
