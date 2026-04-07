/**
 * CommandPaletteContext
 *
 * Lightweight context definition for the Command Palette.
 * This is eagerly loaded so hooks can be used immediately.
 */
import { createContext, useContext, ReactNode } from "react";

export type CommandCategory = "navigation" | "action" | "settings";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  category: CommandCategory;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteContextType {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isOpen: boolean;
  registerCommands: (commands: CommandItem[]) => () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}
