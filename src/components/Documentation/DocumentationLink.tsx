/**
 * Documentation Link Component
 * 
 * Provides contextual help links to documentation pages.
 * Can be placed anywhere in the UI to provide quick access to relevant docs.
 */

import React, { useState } from 'react';
import { HelpCircle, ExternalLink, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface DocumentationLinkProps {
  /** Documentation page slug to link to */
  docSlug?: string;
  /** Search query to find relevant docs */
  searchQuery?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Size of the icon */
  size?: 'sm' | 'md' | 'lg';
  /** Position of the icon */
  position?: 'inline' | 'absolute';
  /** Show as button instead of icon */
  asButton?: boolean;
  /** Button text (if asButton is true) */
  buttonText?: string;
  /** Open in new tab */
  openInNewTab?: boolean;
}

export const DocumentationLink: React.FC<DocumentationLinkProps> = ({
  docSlug,
  searchQuery,
  tooltip = 'View documentation',
  size = 'md',
  position = 'inline',
  asButton = false,
  buttonText = 'Help',
  openInNewTab = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showQuickHelp, setShowQuickHelp] = useState(false);
  const [docContent, setDocContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (docSlug) {
      if (openInNewTab) {
        window.open(`/documentation/${docSlug}`, '_blank');
      } else {
        // Load quick help preview
        setLoading(true);
        setShowQuickHelp(true);

        const { data } = await supabase
          .from('doc_pages')
          .select('*')
          .eq('slug', docSlug)
          .eq('status', 'published')
          .single();

        if (data) {
          setDocContent(data);
        }

        setLoading(false);
      }
    } else if (searchQuery) {
      // Open documentation with search
      window.open(`/documentation?search=${encodeURIComponent(searchQuery)}`, openInNewTab ? '_blank' : '_self');
    }
  };

  const closeQuickHelp = () => {
    setShowQuickHelp(false);
    setDocContent(null);
  };

  if (asButton) {
    return (
      <>
        <button
          onClick={handleClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          aria-label={tooltip}
        >
          <HelpCircle className={sizeClasses[size]} />
          <span>{buttonText}</span>
        </button>

        {showQuickHelp && <QuickHelpModal content={docContent} loading={loading} onClose={closeQuickHelp} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          text-gray-400 hover:text-blue-600 transition-colors
          ${position === 'absolute' ? 'absolute top-2 right-2' : 'inline-flex items-center'}
        `}
        aria-label={tooltip}
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>

      {showTooltip && (
        <div className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap -top-8 left-1/2 transform -translate-x-1/2">
          {tooltip}
          <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}

      {showQuickHelp && <QuickHelpModal content={docContent} loading={loading} onClose={closeQuickHelp} />}
    </>
  );
};

interface QuickHelpModalProps {
  content: any;
  loading: boolean;
  onClose: () => void;
}

const QuickHelpModal: React.FC<QuickHelpModalProps> = ({ content, loading, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Quick Help</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && content && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{content.title}</h2>
              {content.description && (
                <p className="text-gray-600 mb-4">{content.description}</p>
              )}
              <div
                className="prose prose-blue max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.content) }}
              />
            </>
          )}

          {!loading && !content && (
            <div className="text-center py-12 text-gray-500">
              <p>Documentation not found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Close
          </button>
          {content && (
            <a
              href={`/documentation/${content.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <span>View Full Page</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Contextual Help Component
 * 
 * Provides inline help text with optional documentation link
 */
interface ContextualHelpProps {
  text: string;
  docSlug?: string;
  className?: string;
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  text,
  docSlug,
  className = '',
}) => {
  return (
    <div className={`flex items-start gap-2 text-sm text-gray-600 ${className}`}>
      <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p>{text}</p>
        {docSlug && (
          <a
            href={`/documentation/${docSlug}`}
            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 mt-1"
          >
            <span>Learn more</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * Help Section Component
 * 
 * Provides a dedicated help section with links to multiple docs
 */
interface HelpSectionProps {
  title?: string;
  links: Array<{
    label: string;
    docSlug: string;
    description?: string;
  }>;
  className?: string;
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  title = 'Need Help?',
  links,
  className = '',
}) => {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-blue-900 mb-3">{title}</h4>
      <div className="space-y-2">
        {links.map((link, index) => (
          <a
            key={index}
            href={`/documentation/${link.docSlug}`}
            className="block text-sm text-blue-700 hover:text-blue-900 hover:underline"
          >
            <div className="flex items-start gap-2">
              <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">{link.label}</div>
                {link.description && (
                  <div className="text-xs text-blue-600 mt-0.5">{link.description}</div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
