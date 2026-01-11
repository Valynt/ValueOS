/**
 * CommandPalette Component
 *
 * Global command palette accessible via Cmd+K.
 * Provides fuzzy search for pages, sessions, actions, and team members.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  LayoutDashboard,
  Calculator,
  MessageSquare,
  FileText,
  Users,
  Settings,
  LogOut,
  Zap,
  Clock,
  ArrowRight,
  Command,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface CommandItem {
  id: string;
  type: "page" | "session" | "action" | "team";
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (item: CommandItem) => void;
  customItems?: CommandItem[];
}

const typeIcons = {
  page: <FileText className="w-4 h-4" />,
  session: <Clock className="w-4 h-4" />,
  action: <Zap className="w-4 h-4" />,
  team: <Users className="w-4 h-4" />,
};

const typeLabels = {
  page: "Pages",
  session: "Recent Sessions",
  action: "Actions",
  team: "Team",
};

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  customItems = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Default navigation items
  const defaultItems: CommandItem[] = useMemo(
    () => [
      {
        id: "nav-home",
        type: "page",
        label: "Home",
        description: "Go to home dashboard",
        icon: <Home className="w-4 h-4" />,
        action: () => navigate("/home"),
        keywords: ["dashboard", "main"],
      },
      {
        id: "nav-deals",
        type: "page",
        label: "Deals",
        description: "View and manage deals",
        icon: <LayoutDashboard className="w-4 h-4" />,
        action: () => navigate("/deals"),
        keywords: ["sales", "opportunities"],
      },
      {
        id: "nav-canvas",
        type: "page",
        label: "Value Canvas",
        description: "Open value canvas workspace",
        icon: <LayoutDashboard className="w-4 h-4" />,
        action: () => navigate("/canvas"),
        keywords: ["workspace", "editor"],
      },
      {
        id: "nav-calculator",
        type: "page",
        label: "ROI Calculator",
        description: "Calculate return on investment",
        icon: <Calculator className="w-4 h-4" />,
        action: () => navigate("/calculator"),
        keywords: ["roi", "math", "numbers"],
      },
      {
        id: "nav-chat",
        type: "page",
        label: "AI Chat",
        description: "Open conversational AI",
        icon: <MessageSquare className="w-4 h-4" />,
        action: () => navigate("/chat"),
        keywords: ["agent", "assistant", "conversation"],
      },
      {
        id: "nav-docs",
        type: "page",
        label: "Documentation",
        description: "View documentation",
        icon: <FileText className="w-4 h-4" />,
        action: () => navigate("/docs"),
        keywords: ["help", "guide", "manual"],
      },
      {
        id: "nav-settings",
        type: "page",
        label: "Settings",
        description: "Manage your settings",
        icon: <Settings className="w-4 h-4" />,
        action: () => navigate("/settings"),
        keywords: ["preferences", "config"],
      },
      {
        id: "action-logout",
        type: "action",
        label: "Sign Out",
        description: "Sign out of your account",
        icon: <LogOut className="w-4 h-4" />,
        action: () => navigate("/login"),
        keywords: ["logout", "exit"],
      },
    ],
    [navigate]
  );

  const allItems = useMemo(() => [...defaultItems, ...customItems], [defaultItems, customItems]);

  // Fuzzy search implementation
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;

    const lowerQuery = query.toLowerCase();
    return allItems
      .map((item) => {
        let score = 0;

        // Exact match in label
        if (item.label.toLowerCase().includes(lowerQuery)) {
          score += 10;
        }

        // Match in description
        if (item.description?.toLowerCase().includes(lowerQuery)) {
          score += 5;
        }

        // Match in keywords
        if (item.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))) {
          score += 3;
        }

        // Starts with query
        if (item.label.toLowerCase().startsWith(lowerQuery)) {
          score += 5;
        }

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [allItems, query]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type]!.push(item);
    });
    return groups;
  }, [filteredItems]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => {
    return Object.values(groupedItems).flat();
  }, [groupedItems]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatItems.length > 0 && selectedIndex >= 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, flatItems.length]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      onSelect?.(item);
      item.action();
      onClose();
    },
    [onSelect, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, selectedIndex, handleSelect, onClose]
  );

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className={cn(
          "w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl",
          "animate-scale-in overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, sessions..."
            className={cn(
              "flex-1 bg-transparent text-white placeholder-gray-500",
              "text-base outline-none"
            )}
            aria-label="Search commands"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-800 rounded">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2" role="listbox">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            Object.entries(groupedItems).map(([type, items]) => (
              <div key={type}>
                {/* Group header */}
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {typeLabels[type as keyof typeof typeLabels] || type}
                </div>

                {/* Group items */}
                {items.map((item) => {
                  const itemIndex = currentIndex++;
                  const isSelected = itemIndex === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      data-index={itemIndex}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                        "transition-colors",
                        isSelected ? "bg-primary/20 text-white" : "text-gray-300 hover:bg-gray-800"
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {/* Icon */}
                      <span
                        className={cn(
                          "flex-shrink-0",
                          isSelected ? "text-primary" : "text-gray-500"
                        )}
                      >
                        {item.icon || typeIcons[item.type]}
                      </span>

                      {/* Label and description */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.label}</div>
                        {item.description && (
                          <div className="text-sm text-gray-500 truncate">{item.description}</div>
                        )}
                      </div>

                      {/* Shortcut or arrow */}
                      {item.shortcut ? (
                        <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-800 rounded">
                          {item.shortcut}
                        </kbd>
                      ) : (
                        isSelected && <ArrowRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
