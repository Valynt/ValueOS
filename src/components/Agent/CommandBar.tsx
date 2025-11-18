import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { sanitizeUserInput } from '../../utils/security';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (query: string) => void;
  suggestions?: string[];
}

export const CommandBar: React.FC<CommandBarProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suggestions = []
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultSuggestions = [
    'Show cost breakdown analysis',
    'Create scenario comparison',
    'Add assumptions table with benchmarks',
    'Generate ROI timeline chart',
    'Create executive summary',
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;
  const filteredSuggestions = query
    ? displaySuggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : displaySuggestions;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedQuery = filteredSuggestions[selectedIndex] || query;
      const sanitized = sanitizeUserInput(selectedQuery, 512);
      if (sanitized) {
        onSubmit(sanitized);
        setQuery('');
        onClose();
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const sanitized = sanitizeUserInput(suggestion, 512);
    if (!sanitized) return;

    onSubmit(sanitized);
    setQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-20 pointer-events-none">
        <div className="w-full max-w-2xl mx-4 pointer-events-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <Sparkles className="h-5 w-5 text-blue-600 mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the agent anything..."
                className="flex-1 text-base outline-none placeholder-gray-400"
              />
              <button
                onClick={onClose}
                className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {filteredSuggestions.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                <div className="px-2 py-2">
                  <div className="text-xs font-medium text-gray-500 px-3 py-2">
                    {query ? 'Matching Commands' : 'Suggested Commands'}
                  </div>
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        index === selectedIndex
                          ? 'bg-blue-50 text-blue-900'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <Search className="h-4 w-4 mr-3 text-gray-400" />
                        <span className="text-sm">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs">Enter</kbd> Select
                </span>
                <span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd> Close
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span>Agent ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
