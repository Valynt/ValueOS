/**
 * Enhanced Documentation Search Component
 * 
 * Features:
 * - Real-time full-text search with Supabase
 * - Search suggestions and autocomplete
 * - Recent searches
 * - Search analytics
 * - Keyboard navigation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Clock, TrendingUp, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { announceToScreenReader } from '../../utils/accessibility';

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_name: string;
  rank: number;
}

interface DocumentationSearchProps {
  onSelectResult: (slug: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const DocumentationSearch: React.FC<DocumentationSearchProps> = ({
  onSelectResult,
  placeholder = 'Search documentation...',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecentSearches();
    loadPopularSearches();
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      const debounce = setTimeout(() => {
        performSearch();
      }, 300);

      return () => clearTimeout(debounce);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [query]);

  useEffect(() => {
    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecentSearches = () => {
    const recent = localStorage.getItem('doc_recent_searches');
    if (recent) {
      setRecentSearches(JSON.parse(recent));
    }
  };

  const loadPopularSearches = async () => {
    const { data } = await supabase
      .from('doc_analytics')
      .select('search_query')
      .eq('event_type', 'search')
      .not('search_query', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      // Count frequency
      const frequency: Record<string, number> = {};
      data.forEach((item) => {
        if (item.search_query) {
          frequency[item.search_query] = (frequency[item.search_query] || 0) + 1;
        }
      });

      // Sort by frequency
      const popular = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([query]) => query);

      setPopularSearches(popular);
    }
  };

  const performSearch = async () => {
    setIsSearching(true);

    const { data, error } = await supabase.rpc('search_documentation', {
      search_query: query,
      category_filter: null,
      limit_count: 10,
    });

    setIsSearching(false);

    if (data && !error) {
      setResults(data);
      setIsOpen(true);
      announceToScreenReader(`Found ${data.length} results`, 'polite');
    }
  };

  const saveRecentSearch = (searchQuery: string) => {
    const recent = [searchQuery, ...recentSearches.filter((q) => q !== searchQuery)].slice(0, 5);
    setRecentSearches(recent);
    localStorage.setItem('doc_recent_searches', JSON.stringify(recent));
  };

  const logSearchAnalytics = async (searchQuery: string, resultSlug?: string) => {
    await supabase.from('doc_analytics').insert({
      event_type: 'search',
      search_query: searchQuery,
      page_id: resultSlug ? undefined : null,
    });
  };

  const handleSelectResult = (result: SearchResult) => {
    saveRecentSearch(query);
    logSearchAnalytics(query, result.slug);
    onSelectResult(result.slug);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('doc_recent_searches');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        } else if (query.length >= 2) {
          saveRecentSearch(query);
          logSearchAnalytics(query);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search documentation"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={isOpen}
        />
        {isSearching && (
          <div className="absolute right-3 top-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id="search-results"
          className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
          role="listbox"
        >
          {/* Search Results */}
          {results.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                Results
              </div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full text-left p-3 rounded hover:bg-gray-50 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <h3 className="font-medium text-gray-900">{result.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {result.description}
                  </p>
                  <span className="text-xs text-gray-500 mt-1 inline-block">
                    {result.category_name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && results.length === 0 && !isSearching && (
            <div className="p-6 text-center text-gray-500">
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-2">Try different keywords or browse categories</p>
            </div>
          )}

          {/* Recent Searches */}
          {query.length < 2 && recentSearches.length > 0 && (
            <div className="p-2 border-b">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Searches
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(search)}
                  className="w-full text-left p-3 rounded hover:bg-gray-50 flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
          {query.length < 2 && popularSearches.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Popular Searches
              </div>
              {popularSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(search)}
                  className="w-full text-left p-3 rounded hover:bg-gray-50 flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
