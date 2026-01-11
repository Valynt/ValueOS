/**
 * CommandPaletteProvider
 *
 * Global provider for Command Palette state and keyboard shortcut.
 * Wrap your app with this to enable Cmd+K anywhere.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { CommandPalette, type CommandItem } from "./CommandPalette";

interface CommandPaletteContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerItems: (items: CommandItem[]) => void;
  unregisterItems: (ids: string[]) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customItems, setCustomItems] = useState<CommandItem[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerItems = useCallback((items: CommandItem[]) => {
    setCustomItems((prev) => [...prev, ...items]);
  }, []);

  const unregisterItems = useCallback((ids: string[]) => {
    setCustomItems((prev) => prev.filter((item) => !ids.includes(item.id)));
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <CommandPaletteContext.Provider
      value={{ isOpen, open, close, toggle, registerItems, unregisterItems }}
    >
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} customItems={customItems} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return context;
}

export default CommandPaletteProvider;
