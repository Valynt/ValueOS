// Stub ToastProvider for development
import { createContext, ReactNode, useContext } from "react";

interface ToastContextType {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = (message: string, type?: "success" | "error" | "info") => {
    console.log("Toast:", message, type);
    // In a real implementation, this would show a toast notification
  };

  return <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
