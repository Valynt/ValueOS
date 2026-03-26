/**
 * Toast notification system
 *
 * Replaces the previous stub that only logged to console.
 * Provides a real UI with auto-dismiss, stacking, and accessible announcements.
 *
 * UX Principles:
 * - Immediate feedback: confirms actions or surfaces errors without blocking
 * - WCAG compliant: uses role="status" / role="alert" for screen readers
 * - Non-intrusive: auto-dismisses after a timeout
 */

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { DEFAULT_TOAST_DURATION_MS, TOAST_EXIT_ANIMATION_MS } from "@/components/ui/toast-config";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  /** Convenience: show an error toast */
  error: (message: string) => void;
  /** Convenience: show a success toast */
  success: (message: string) => void;
  /** Convenience: show an info toast */
  info: (message: string) => void;
}

const MAX_VISIBLE_TOASTS = 5;

let toastCounter = 0;

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/* ------------------------------------------------------------------ */
/*  Individual toast                                                   */
/* ------------------------------------------------------------------ */

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const styleMap: Record<ToastType, string> = {
  success: "border-success/30 bg-success/5 text-success",
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  info: "border-primary/30 bg-primary/5 text-primary",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = iconMap[toast.type];
  const [isExiting, setIsExiting] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDismissedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const dismissWithAnimation = useCallback(() => {
    if (hasDismissedRef.current) {
      return;
    }

    hasDismissedRef.current = true;
    setIsExiting(true);
    clearTimers();
    exitTimerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, TOAST_EXIT_ANIMATION_MS);
  }, [clearTimers, onDismiss, toast.id]);

  useEffect(() => {
    hasDismissedRef.current = false;
    dismissTimerRef.current = setTimeout(() => {
      dismissWithAnimation();
    }, DEFAULT_TOAST_DURATION_MS);

    return () => {
      clearTimers();
    };
  }, [clearTimers, dismissWithAnimation]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200",
        "bg-popover text-popover-foreground",
        styleMap[toast.type],
        isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100",
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-foreground">{toast.message}</p>
      <button
        onClick={dismissWithAnimation}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, type, createdAt: Date.now() }];
      // Keep only the most recent toasts visible
      return next.slice(-MAX_VISIBLE_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const errorToast = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const successToast = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const infoToast = useCallback((message: string) => showToast(message, "info"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, error: errorToast, success: successToast, info: infoToast }}>
      {children}

      {/* Toast container - fixed bottom-right */}
      {toasts.length > 0 && (
        <div
          aria-label="Notifications"
          className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
