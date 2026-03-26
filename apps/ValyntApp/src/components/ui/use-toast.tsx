/**
 * Toast Hook
 *
 * Toast notification system using sonner
 */

import { toast } from "sonner";

import { DEFAULT_TOAST_DURATION_MS } from "./toast-config";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

export function useToast() {
  return {
    toast: (options: ToastOptions) => {
      const { title, description, variant = "default", duration = DEFAULT_TOAST_DURATION_MS } = options;
      const message = title || description || "";

      switch (variant) {
        case "destructive":
          toast.error(message, { description: title ? description : undefined, duration });
          break;
        case "success":
          toast.success(message, { description: title ? description : undefined, duration });
          break;
        default:
          toast(message, { description: title ? description : undefined, duration });
      }
    },
    dismiss: toast.dismiss,
  };
}

export { toast };
