/**
 * CommandPalette (Legacy/Eager Provider)
 *
 * ⚠️ DEPRECATED: Use LazyCommandPaletteProvider from './LazyCommandPalette' instead
 * for better bundle splitting. This file is kept for backward compatibility.
 *
 * The implementation has been split into:
 * - CommandPaletteContext.tsx: Context and hook (eager)
 * - CommandPaletteDialog.tsx: Heavy UI component (lazy-loaded)
 * - LazyCommandPalette.tsx: Provider with deferred loading (recommended)
 */

import { ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { FileText, Home, LayoutDashboard, Settings, Users, Zap } from "lucide-react";

import { safeNavigate } from "@/lib/safeNavigation";
import { InlineSkeleton } from "@/components/common/LayoutSkeleton";
import {
  CommandPaletteContext,
  type CommandItem,
  type CommandPaletteContextType,
  useCommandPalette,
} from "./CommandPaletteContext";

// Re-export for backward compatibility
export {
  CommandPaletteContext,
  type CommandItem,
  type CommandPaletteContextType,
  useCommandPalette,
} from "./CommandPaletteContext";

export type { ElementType };

// Lazy load the heavy dialog UI
const LazyCommandPaletteDialog = lazy(() =>
  import("./CommandPaletteDialog").then((m) => ({ default: m.CommandPaletteDialog }))
);

// Default icons available for commands
export const CommandPaletteIcons = {
  Home,
  LayoutDashboard,
  Zap,
  FileText,
  Settings,
  Users,
};

function createDefaultCommands(navigate: (path: string) => void) {
  return [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      description: "View your deal pipeline overview",
      icon: Home,
      category: "navigation" as const,
      keywords: ["home", "overview", "pipeline"],
      onSelect: () => navigate("/dashboard"),
    },
    {
      id: "nav-opportunities",
      label: "Go to Opportunities",
      description: "Browse and manage opportunities",
      icon: LayoutDashboard,
      category: "navigation" as const,
      keywords: ["deals", "pipeline", "prospects"],
      onSelect: () => navigate("/opportunities"),
    },
    {
      id: "nav-agents",
      label: "Go to Agents",
      description: "View AI agent configurations",
      icon: Zap,
      category: "navigation" as const,
      keywords: ["ai", "automation", "bots"],
      onSelect: () => navigate("/agents"),
    },
    {
      id: "nav-models",
      label: "Go to Models",
      description: "Browse value models",
      icon: FileText,
      category: "navigation" as const,
      keywords: ["value", "modeling", "templates"],
      onSelect: () => navigate("/models"),
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      description: "Manage organization settings",
      icon: Settings,
      category: "settings" as const,
      keywords: ["preferences", "config", "organization"],
      onSelect: () => navigate("/settings"),
    },
    {
      id: "nav-team",
      label: "Manage Team",
      description: "Invite and manage team members",
      icon: Users,
      category: "settings" as const,
      keywords: ["users", "invite", "roles", "permissions"],
      onSelect: () => navigate("/settings/team"),
    },
  ];
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [extraCommands, setExtraCommands] = useState<CommandItem[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const navigate = useCallback((path: string) => {
    safeNavigate(path, { fallback: "/dashboard" });
  }, []);

  const defaultCommands = useMemo(() => createDefaultCommands(navigate), [navigate]);
  const allCommands = useMemo(
    () => [...defaultCommands, ...extraCommands],
    [defaultCommands, extraCommands]
  );

  const openCommandPalette = useCallback(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);
  const closeCommandPalette = useCallback(() => {
    setIsOpen(false);
    previousFocusRef.current?.focus();
  }, []);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      const isEditableTarget =
        target instanceof HTMLElement
        && (target.isContentEditable
          || target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT");

      if (isEditableTarget) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const aiSuggestions = useMemo(() => allCommands.slice(0, 3), [allCommands]);

  const contextValue: CommandPaletteContextType = useMemo(
    () => ({ openCommandPalette, closeCommandPalette, isOpen, registerCommands }),
    [openCommandPalette, closeCommandPalette, isOpen, registerCommands]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      {isOpen && (
        <Suspense fallback={<InlineSkeleton lines={3} />}>
          <LazyCommandPaletteDialog
            commands={allCommands}
            aiSuggestions={aiSuggestions}
            onClose={closeCommandPalette}
          />
        </Suspense>
      )}
    </CommandPaletteContext.Provider>
  );
}
