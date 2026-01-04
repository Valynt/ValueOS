/**
 * Documentation Header Link Component
 * 
 * Adds a documentation link to the app header/toolbar.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

interface DocsHeaderLinkProps {
  /** Show as icon only (for mobile) */
  iconOnly?: boolean;
  /** Custom className */
  className?: string;
}

export const DocsHeaderLink: React.FC<DocsHeaderLinkProps> = ({
  iconOnly = false,
  className = ''
}) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/docs')}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors duration-200
        ${className}
      `}
      aria-label="Open documentation"
      title="Documentation"
    >
      <BookOpen className="w-5 h-5" />
      {!iconOnly && (
        <span className="text-sm font-medium">Docs</span>
      )}
    </button>
  );
};

export default DocsHeaderLink;
