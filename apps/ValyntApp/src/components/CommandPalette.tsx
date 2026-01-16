// Stub CommandPaletteProvider for development
import React, { createContext, useContext, ReactNode } from "react";

interface CommandPaletteContextType {
  openCommandPalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const openCommandPalette = () => {
    console.log("Open command palette");
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
