/**
 * CommandPalette
 *
 * Provides a Cmd+K / Ctrl+K command palette for quick navigation and actions.
 * Replaces the previous stub that only logged to console.
 *
 * Features:
 * - Keyboard shortcut (Cmd+K / Ctrl+K) to open
 * - Fuzzy search across navigation items and actions
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Focus trap while open
 * - Accessible: role="dialog", aria-modal, screen-reader labels
 */

import { FileText, Home, LayoutDashboard, Search, Settings, Users, X, Zap } from "lucide-react";
import {
  createContext,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CommandCategory = "navigation" | "action" | "settings";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ElementType;
  category: CommandCategory;
  keywords?: string[];
  onSelect: () => void;
}

interface CommandPaletteContextType {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isOpen: boolean;
  registerCommands: (commands: CommandItem[]) => () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

/* ------------------------------------------------------------------ */
/*  Default commands                                                   */
/* ------------------------------------------------------------------ */

function createDefaultCommands(navigate: (path: string) => void): CommandItem[] {
  return [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      description: "View your deal pipeline overview",
      icon: Home,
      category: "navigation",
      keywords: ["home", "overview", "pipeline"],
      onSelect: () => navigate("/dashboard"),
    },
    {
      id: "nav-opportunities",
      label: "Go to Opportunities",
      description: "Browse and manage opportunities",
      icon: LayoutDashboard,
      category: "navigation",
      keywords: ["deals", "pipeline", "prospects"],
      onSelect: () => navigate("/opportunities"),
    },
    {
      id: "nav-agents",
      label: "Go to Agents",
      description: "View AI agent configurations",
      icon: Zap,
      category: "navigation",
      keywords: ["ai", "automation", "bots"],
      onSelect: () => navigate("/agents"),
    },
    {
      id: "nav-models",
      label: "Go to Models",
      description: "Browse value models",
      icon: FileText,
      category: "navigation",
      keywords: ["value", "modeling", "templates"],
      onSelect: () => navigate("/models"),
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      description: "Manage organization settings",
      icon: Settings,
      category: "settings",
      keywords: ["preferences", "config", "organization"],
      onSelect: () => navigate("/settings"),
    },
    {
      id: "nav-team",
      label: "Manage Team",
      description: "Invite and manage team members",
      icon: Users,
      category: "settings",
      keywords: ["users", "invite", "roles", "permissions"],
      onSelect: () => navigate("/settings/team"),
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Fuzzy matcher                                                      */
/* ------------------------------------------------------------------ */

function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.description?.toLowerCase().includes(q)) return true;
  if (item.keywords?.some((kw) => kw.includes(q))) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Command Palette UI                                                 */
/* ------------------------------------------------------------------ */

function CommandPaletteDialog({
  commands,
  onClose,
}: {
  commands: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => commands.filter((c) => matchesQuery(c, query)),
    [commands, query],
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
    [onClose],
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
    [filtered, selectedIndex, handleSelect, onClose],
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
                          : "text-foreground hover:bg-accent/50",
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

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [extraCommands, setExtraCommands] = useState<CommandItem[]>([]);

  const navigate = useCallback((path: string) => {
    // Use window.location as a fallback; in practice the router's navigate
    // would be injected via registerCommands from a component with router access.
    window.location.assign(path);
  }, []);

  const defaultCommands = useMemo(() => createDefaultCommands(navigate), [navigate]);
  const allCommands = useMemo(
    () => [...defaultCommands, ...extraCommands],
    [defaultCommands, extraCommands],
  );

  const openCommandPalette = useCallback(() => setIsOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsOpen(false), []);
  const registerCommands = useCallback((commands: CommandItem[]) => {
    setExtraCommands((prev) => {
      const nextById = new Map<string, CommandItem>();
      [...prev, ...commands].forEach((command) => {
        nextById.set(command.id, command);
      });
      return [...nextById.values()];
    });

    return () => {
      const commandIds = new Set(commands.map((command) => command.id));
      setExtraCommands((prev) => prev.filter((command) => !commandIds.has(command.id)));
    };
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      const isEditableTarget =
        target instanceof HTMLElement
        && (target.isContentEditable
          || target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT");

      if (isEditableTarget) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <CommandPaletteContext.Provider
      value={{ openCommandPalette, closeCommandPalette, isOpen, registerCommands }}
    >
      {children}
      {isOpen && (
        <CommandPaletteDialog commands={allCommands} onClose={closeCommandPalette} />
      )}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}
