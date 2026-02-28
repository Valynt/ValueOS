// Stub CommandPaletteProvider for development
import { createContext, ReactNode, useContext } from "react";

import { logger } from "@/lib/logger";

interface CommandPaletteContextType {
  openCommandPalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const openCommandPalette = () => {
    logger.debug("Open command palette");
  };

  return (
    <CommandPaletteContext.Provider value={{ openCommandPalette }}>
      {children}
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
