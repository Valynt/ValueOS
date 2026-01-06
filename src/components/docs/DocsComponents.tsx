/**
 * Supporting Documentation Components
 */

import React, { useState } from 'react';
import { Breadcrumb, TableOfContents, TocItem } from './types';

// Breadcrumbs Component
interface DocsBreadcrumbsProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (sectionId: string) => void;
}

export const DocsBreadcrumbs: React.FC<DocsBreadcrumbsProps> = ({ breadcrumbs, onNavigate }) => {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {crumb.sectionId ? (
            <button
              onClick={() => onNavigate(crumb.sectionId!)}
              className="hover:text-blue-600"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// Table of Contents Component
interface DocsTableOfContentsProps {
  toc: TableOfContents;
  activeHeading: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DocsTableOfContents: React.FC<DocsTableOfContentsProps> = ({
  toc,
  activeHeading,
  isOpen,
  onClose
}) => {
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className={`
      w-64 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto
      ${isOpen ? 'block' : 'hidden lg:block'}
    `}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          On This Page
        </h3>
        <button
          onClick={onClose}
          className="lg:hidden text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav>
        <ul className="space-y-2">
          {toc.items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => scrollToHeading(item.id)}
                className={`
                  text-sm text-left w-full py-1 px-2 rounded
                  ${item.level === 3 ? 'pl-4' : ''}
                  ${activeHeading === item.id
                    ? 'text-blue-600 font-medium bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

// Copy Button Component
interface DocsCopyButtonProps {
  code: string;
}

export const DocsCopyButton: React.FC<DocsCopyButtonProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity"
      aria-label="Copy code"
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </span>
      )}
    </button>
  );
};

// Related Links Component
interface DocsRelatedLinksProps {
  relatedSections: string[];
  onNavigate: (sectionId: string) => void;
}

export const DocsRelatedLinks: React.FC<DocsRelatedLinksProps> = ({
  relatedSections,
  onNavigate
}) => {
  if (!relatedSections || relatedSections.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Related Documentation
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {relatedSections.map((sectionId) => (
          <button
            key={sectionId}
            onClick={() => onNavigate(sectionId)}
            className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 text-blue-600">
              <span className="font-medium">{formatSectionTitle(sectionId)}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Helper function
function formatSectionTitle(sectionId: string): string {
  return sectionId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
