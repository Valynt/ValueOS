import React, { useState, useEffect, useRef } from 'react';
import { Search, Command } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { settingsRegistry } from '../../lib/settingsRegistry';
import { SettingsSearchResult } from '../../types';

interface SettingsSearchBarProps {
  onClose?: () => void;
}

export const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({ onClose }) => {
  const { navigateTo, permissions } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SettingsSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = settingsRegistry.search(query, permissions.permissions);
      setResults(searchResults.slice(0, 8));
      setSelectedIndex(0);
    } else {
      setResults([]);
      setSelectedIndex(0);
    }
  }, [query, permissions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    }
  };

  const handleSelectResult = (result: SettingsSearchResult) => {
    navigateTo(result.route.path);
    setIsOpen(false);
    setQuery('');
    setResults([]);
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search settings...</span>
        <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono bg-white border border-gray-300 rounded">
          <Command className="h-3 w-3 mr-1" />K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search settings..."
            className="flex-1 outline-none text-lg"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
            ESC
          </kbd>
        </div>

        {results.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={result.route.id}
                onClick={() => handleSelectResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-4 py-3 flex flex-col border-b border-gray-100 transition-colors ${
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{result.route.label}</span>
                  <span className="text-xs text-gray-500">
                    {result.route.tier === 'user' && 'My Account'}
                    {result.route.tier === 'team' && 'Workspace'}
                    {result.route.tier === 'organization' && 'Organization'}
                  </span>
                </div>
                {result.route.description && (
                  <span className="text-sm text-gray-600 mt-1">{result.route.description}</span>
                )}
                <span className="text-xs text-gray-400 mt-1">{result.route.path}</span>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No settings found for "{query}"</p>
            <p className="text-sm mt-1">Try different keywords or check your permissions</p>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Start typing to search settings</p>
            <p className="text-sm mt-1">Use ↑↓ to navigate and ↵ to select</p>
          </div>
        )}
      </div>
    </div>
  );
};
