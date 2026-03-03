// Minimal AppContext — placeholder for future state management
import { createContext, useContext, type ReactNode } from "react";

interface AppContextType {}

const AppContext = createContext<AppContextType>({});

export function AppProvider({ children }: { children: ReactNode }) {
  return <AppContext.Provider value={{}}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
