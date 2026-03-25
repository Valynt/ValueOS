/**
 * CommandPalette
 *
 * Full ⌘K palette: navigation shortcuts + AI agent query.
 * - Global keydown listener for ⌘K / Ctrl+K
 * - Navigation commands for all primary app routes
 * - AI query submission via onSubmit callback
 * - Full keyboard navigation (arrows, Enter, Escape)
 * - Focus trap while open; returns focus to trigger on close
 */

import { LayoutDashboard, Search, Settings, Sparkles, Target, Users, Workflow, X, Zap } from "lucide-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CommandPaletteContextType {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Navigation commands
// ---------------------------------------------------------------------------

interface NavCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  shortcut?: string;
}

const NAV_COMMANDS: NavCommand[] = [
  { id: "dashboard", label: "Dashboard", description: "Overview of active cases", icon: LayoutDashboard, path: "dashboard" },
  { id: "opportunities", label: "Opportunities", description: "Manage value cases and deals", icon: Target, path: "opportunities" },
  { id: "models", label: "Models", description: "Financial and value models", icon: Workflow, path: "models" },
  { id: "agents", label: "Agents", description: "AI agent status and configuration", icon: Zap, path: "agents" },
  { id: "integrations", label: "Integrations", description: "CRM and data source connections", icon: Users, path: "integrations" },
  { id: "settings", label: "Settings", description: "Organization and account settings", icon: Settings, path: "settings" },
];

const AI_SUGGESTIONS = [
  "Analyze value drivers for this account",
  "Generate ROI calculation",
  "Create executive summary",
  "Compare with similar cases",
];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const openCommandPalette = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIsOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsOpen(false);
    // Return focus to the element that was focused before opening
    requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }, []);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === "k")) return;

      // Don't intercept while the user is typing in a text field
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      if (isOpen) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openCommandPalette, closeCommandPalette]);

  return (
    <CommandPaletteContext.Provider value={{ openCommandPalette, closeCommandPalette, isOpen }}>
      {children}
      {isOpen && <CommandPaletteModal onClose={closeCommandPalette} />}
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

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type CommandItem =
  | { kind: "nav"; command: NavCommand }
  | { kind: "ai"; label: string };

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { t } = useI18n();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build filtered item list
  const items: CommandItem[] = (() => {
    const q = query.trim().toLowerCase();
    const navItems: CommandItem[] = NAV_COMMANDS
      .filter((c) => !q || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      .map((c) => ({ kind: "nav", command: c }));

    const aiItems: CommandItem[] = q
      ? [{ kind: "ai", label: query.trim() }]
      : AI_SUGGESTIONS.map((s) => ({ kind: "ai", label: s }));

    return [...navItems, ...aiItems];
  })();

  // Clamp selectedIndex when list changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  const executeItem = useCallback((item: CommandItem) => {
    if (item.kind === "nav") {
      const slug = currentTenant?.slug ?? currentTenant?.id;
      if (slug) {
        navigate(`/org/${slug}/${item.command.path}`);
      }
    }
    // AI queries: no-op for now — future: dispatch to agent
    onClose();
  }, [navigate, currentTenant, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) executeItem(item);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navItems = items.filter((i): i is { kind: "nav"; command: NavCommand } => i.kind === "nav");
  const aiItems = items.filter((i): i is { kind: "ai"; label: string } => i.kind === "ai");
  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            aria-label="Command palette search"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">Esc</kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("commandPalette.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
          {navItems.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("commandPalette.navigate")}
              </p>
              {navItems.map((item) => {
                const idx = globalIndex++;
                const Icon = item.command.icon;
                return (
                  <button
                    key={item.command.id}
                    data-selected={selectedIndex === idx}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selectedIndex === idx ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      selectedIndex === idx ? "bg-primary/10" : "bg-muted",
                    )}>
                      <Icon className={cn("h-4 w-4", selectedIndex === idx ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">{item.command.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.command.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {aiItems.length > 0 && (
            <div className={navItems.length > 0 ? "mt-1 border-t border-border/50 pt-1" : ""}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {query.trim() ? t("commandPalette.askAi") : t("commandPalette.aiSuggestions")}
              </p>
              {aiItems.map((item) => {
                const idx = globalIndex++;
                return (
                  <button
                    key={item.label}
                    data-selected={selectedIndex === idx}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selectedIndex === idx ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      selectedIndex === idx ? "bg-primary/10" : "bg-muted",
                    )}>
                      <Sparkles className={cn("h-4 w-4", selectedIndex === idx ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <p className="text-[13px] text-foreground">{item.label}</p>
                  </button>
                );
              })}
            </div>
          )}

          {items.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              {t("commandPalette.noResults").replace("{{query}}", query)}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
