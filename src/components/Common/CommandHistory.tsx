/**
 * Command History Component
 * Shows recent commands and allows re-running them
 */

import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, Search, Trash2 } from 'lucide-react';

export interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: Date;
  success: boolean;
}

interface CommandHistoryProps {
  onSelectCommand: (command: string) => void;
  className?: string;
}

const STORAGE_KEY = 'valuecanvas_command_history';
const MAX_HISTORY_ITEMS = 50;

export const CommandHistory: React.FC<CommandHistoryProps> = ({
  onSelectCommand,
  className = '',
}) => {
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert timestamp strings back to Date objects
          const items = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
          setHistory(items);
        }
      } catch (error) {
        console.error('Failed to load command history:', error);
      }
    };

    loadHistory();
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }, [history]);

  const addToHistory = (command: string, success: boolean = true) => {
    const newItem: CommandHistoryItem = {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      success,
    };

    setHistory(prev => {
      // Remove duplicates of the same command
      const filtered = prev.filter(item => item.command !== command);
      // Add new item at the beginning
      const updated = [newItem, ...filtered];
      // Limit to MAX_HISTORY_ITEMS
      return updated.slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const filteredHistory = history.filter(item =>
    item.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Expose addToHistory method
  React.useImperativeHandle(
    React.useRef(),
    () => ({
      addToHistory,
    }),
    []
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Command History</h3>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Clear history"
            title="Clear all history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      {history.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              aria-label="Search command history"
            />
          </div>
        </div>
      )}

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Clock className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              {searchQuery
                ? 'No matching commands found'
                : 'No command history yet'}
            </p>
            {!searchQuery && (
              <p className="text-gray-400 text-xs mt-1">
                Your recent commands will appear here
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200" role="list">
            {filteredHistory.map((item) => (
              <li
                key={item.id}
                className="group hover:bg-gray-50 transition-colors"
              >
                <button
                  onClick={() => onSelectCommand(item.command)}
                  className="w-full text-left p-4 flex items-start gap-3 focus:outline-none focus:bg-indigo-50"
                  aria-label={`Re-run command: ${item.command}`}
                >
                  <RotateCcw
                    className="w-4 h-4 text-gray-400 mt-0.5 group-hover:text-indigo-600 transition-colors flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {item.command}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(item.timestamp)}
                    </p>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      item.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    aria-label={item.success ? 'Successful' : 'Failed'}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Hook to manage command history
 */
export const useCommandHistory = () => {
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const items = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
          setHistory(items);
        }
      } catch (error) {
        console.error('Failed to load command history:', error);
      }
    };

    loadHistory();
  }, []);

  const addToHistory = (command: string, success: boolean = true) => {
    const newItem: CommandHistoryItem = {
      id: Date.now().toString(),
      command,
      timestamp: new Date(),
      success,
    };

    setHistory(prev => {
      const filtered = prev.filter(item => item.command !== command);
      const updated = [newItem, ...filtered];
      const limited = updated.slice(0, MAX_HISTORY_ITEMS);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
      } catch (error) {
        console.error('Failed to save command history:', error);
      }
      
      return limited;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    history,
    addToHistory,
    clearHistory,
  };
};
