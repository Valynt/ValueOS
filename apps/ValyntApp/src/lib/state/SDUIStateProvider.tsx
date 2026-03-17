// Stub SDUIStateProvider for development
import { createContext, ReactNode, useContext } from "react";

interface SDUIStateContextType {
  // Stub
}

const SDUIStateContext = createContext<SDUIStateContextType | undefined>(undefined);

export function SDUIStateProvider({ children, _supabase }: { children: ReactNode; supabase?: unknown }) {
  return <SDUIStateContext.Provider value={{}}>{children}</SDUIStateContext.Provider>;
}

export function useSDUIState() {
  const context = useContext(SDUIStateContext);
  if (!context) {
    throw new Error("useSDUIState must be used within a SDUIStateProvider");
  }
  return context;
}
