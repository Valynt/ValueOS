/**
 * Documentation Search Component
 * 
 * Full-text search with role-based filtering and result highlighting.
 * Prioritizes non-technical results for business users.
 */

import React from 'react';
import { SearchResult, UserRole } from './types';

interface DocsSearchProps {
  query: string;
  results: SearchResult[];
  onSelectResult: (sectionId: string) => void;
  userRole: UserRole;
}

export const DocsSearch: React.FC<DocsSearchProps> = ({
  query,
  results,
  onSelectResult,
  userRole
}) => {
  if (!query || query.length < 3) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg">Type at least 3 characters to search</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No results found
          </h3>
          <p className="text-gray-600 mb-6">
            We couldn't find any documentation matching "{query}"
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Search tips:</strong>
            </p>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              <li>• Try different keywords</li>
              <li>• Check your spelling</li>
              <li>• Use simpler terms</li>
              <li>• Browse categories instead</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Search header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Search Results
        </h2>
        <p className="text-gray-600">
          Found {results.length} {results.length === 1 ? 'result' : 'results'} for "{query}"
        </p>
      </div>

      {/* Results list */}
      <div className="space-y-6">
        {results.map((result, index) => (
          <SearchResultCard
            key={result.section.id}
            result={result}
            query={query}
            onSelect={onSelectResult}
            userRole={userRole}
            rank={index + 1}
          />
        ))}
      </div>

      {/* Help section */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Can't find what you're looking for?
        </h3>
        <p className="text-gray-600 mb-4">
          Our support team is here to help you find the information you need.
        </p>
        <div className="flex gap-3">
          <a
            href="/support"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Contact Support
          </a>
          <a
            href="/community"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Ask Community
          </a>
        </div>
      </div>
    </div>
  );
};

// Search result card component
interface SearchResultCardProps {
  result: SearchResult;
  query: string;
  onSelect: (sectionId: string) => void;
  userRole: UserRole;
  rank: number;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  query,
  onSelect,
  userRole,
  rank
}) => {
  const { section, matches, score } = result;
  const isTechnical = section.category === 'developer-guide' || section.category === 'api-reference';
  const showTechnicalWarning = isTechnical && (userRole === 'business' || userRole === 'executive');

  return (
    <article
      className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onSelect(section.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {getCategoryLabel(section.category)}
            </span>
            {showTechnicalWarning && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                Technical
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 hover:text-blue-600">
            {highlightText(section.title, query)}
          </h3>
          {section.description && (
            <p className="text-gray-600 mt-1">
              {highlightText(section.description, query)}
            </p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <div className="text-sm text-gray-500">
            #{rank}
          </div>
        </div>
      </div>

      {/* Matches */}
      {matches.length > 0 && (
        <div className="space-y-2 mb-4">
          {matches.slice(0, 2).map((match, index) => (
            <div key={index} className="text-sm">
              <p className="text-gray-700">
                ...{highlightText(match.context, query)}...
              </p>
            </div>
          ))}
          {matches.length > 2 && (
            <p className="text-xs text-gray-500">
              +{matches.length - 2} more {matches.length - 2 === 1 ? 'match' : 'matches'}
            </p>
          )}
        </div>
      )}

      {/* Technical warning */}
      {showTechnicalWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-sm text-yellow-800">
            💡 This is technical documentation. You may want to share this with your technical team.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          {section.estimatedTime && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {section.estimatedTime}
            </span>
          )}
          {section.difficulty && (
            <span className={`px-2 py-0.5 rounded text-xs ${
              section.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
              section.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {section.difficulty}
            </span>
          )}
        </div>
        <span className="text-xs">
          Relevance: {Math.round(score * 100)}%
        </span>
      </div>
    </article>
  );
};

// Helper functions

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'overview': 'Getting Started',
    'user-guide': 'User Guide',
    'developer-guide': 'Developer Guide',
    'api-reference': 'API Reference'
  };
  return labels[category] || category;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 font-medium">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default DocsSearch;
