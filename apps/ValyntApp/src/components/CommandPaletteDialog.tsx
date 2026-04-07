/**
 * CommandPaletteDialog
 *
 * The heavy UI component for the command palette.
 * This is lazy-loaded only when the user opens the palette.
 */
import { FileText, Home, LayoutDashboard, Search, Settings, Users, X, Zap } from "lucide-react";
import {
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import type { CommandItem } from "./CommandPaletteContext";

interface SearchableCommand {
  command: CommandItem;
  label: string;
  description: string;
  keywords: string[];
}

interface CommandPaletteDialogProps {
  commands: CommandItem[];
  aiSuggestions: CommandItem[];
  onClose: () => void;
}

export function CommandPaletteDialog({
  commands,
  aiSuggestions,
  onClose,
}: CommandPaletteDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchableCommands = useMemo<SearchableCommand[]>(
    () => commands.map((command) => ({
      command,
      label: command.label.toLowerCase(),
      description: command.description?.toLowerCase() ?? "",
      keywords: command.keywords?.map((keyword) => keyword.toLowerCase()) ?? [],
    })),
    [commands]
  );

  const filtered = useMemo(
    () => {
      const normalizedQuery = query.toLowerCase();
      if (!normalizedQuery) {
        return searchableCommands.map(({ command }) => command);
      }

      return searchableCommands
        .filter(({ label, description, keywords }) => (
          label.includes(normalizedQuery)
          || description.includes(normalizedQuery)
          || keywords.some((keyword) => keyword.includes(normalizedQuery))
        ))
        .map(({ command }) => command);
    },
    [query, searchableCommands]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.onSelect();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    navigation: "Navigation",
    action: "Actions",
    settings: "Settings",
  };

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filtered]);

  let globalIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed inset-x-0 top-[20%] z-50 mx-auto max-w-lg"
        onKeyDown={handleKeyDown}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              aria-label="Search commands"
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={
                filtered[selectedIndex]
                  ? `cmd-${filtered[selectedIndex].id}`
                  : undefined
              }
            />
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close command palette"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Screen-reader announcement for result count */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {filtered.length === 0
              ? "No results found"
              : `${filtered.length} command${filtered.length === 1 ? "" : "s"} available`}
          </div>

          {/* Results */}
          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            className="max-h-72 overflow-y-auto p-2"
          >
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </p>
            )}

            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {categoryLabels[category] ?? category}
                </p>
                {items.map((item) => {
                  globalIndex++;
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = item.icon;
                  const idx = globalIndex;

                  return (
                    <div
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      data-index={idx}
                      onClick={() => handleSelect(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelect(item);
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      {Icon && (
                        <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-[12px] text-muted-foreground truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {query.length === 0 && aiSuggestions.length > 0 && (
              <div>
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Suggestions
                </p>
                {aiSuggestions.map((item) => (
                  <div
                    key={`ai-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/50"
                  >
                    <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[12px] text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-4">
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">&uarr;</kbd> <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">&darr;</kbd> navigate</span>
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> select</span>
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}
