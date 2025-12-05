import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, X } from 'lucide-react';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { settingsRegistry } from '../../lib/settingsRegistry';
import { SettingsSearchResult } from '../../types';

interface GlobalSearchProps {
  onNavigate: (path: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SettingsSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcut(
    () => setIsOpen(true),
    { key: 'k', metaKey: true }
  );

  useKeyboardShortcut(
    () => setIsOpen(true),
    { key: 'k', ctrlKey: true }
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = settingsRegistry.search(query, [
        'user.view',
        'team.view',
        'team.manage',
        'organization.manage',
        'members.manage',
      ]);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelectResult = (result: SettingsSearchResult) => {
    onNavigate(result.path);
    setIsOpen(false);
    announceToScreenReader(`Navigating to ${result.label}`);
  };

  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        aria-label="Open search (Command+K)"
      >
        <Search className="h-4 w-4" />
        <span>Search settings</span>
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 pt-20 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center border-b border-gray-200 px-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings..."
            className="flex-1 px-3 py-4 text-gray-900 placeholder-gray-500 focus:outline-none"
            aria-label="Search settings"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={results[selectedIndex] ? `result-${selectedIndex}` : undefined}
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close search"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div
          id="search-results"
          className="max-h-96 overflow-y-auto"
          role="listbox"
        >
          {query && results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-gray-600">No results found for "{query}"</p>
              <p className="text-sm text-gray-500 mt-2">
                Try a different search term
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.path}
                  id={`result-${index}`}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 border-l-2 border-blue-600'
                      : 'hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="font-medium text-gray-900">{result.label}</p>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {result.tier}
                      </span>
                    </div>
                    {result.description && (
                      <p className="text-sm text-gray-600 truncate">
                        {result.description}
                      </p>
                    )}
                    {result.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.matchedTerms.map((term, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight
                    className={`h-5 w-5 flex-shrink-0 ml-3 ${
                      index === selectedIndex ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-600">
              <p className="mb-2">Start typing to search settings</p>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↵</kbd>
                  <span>Select</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
