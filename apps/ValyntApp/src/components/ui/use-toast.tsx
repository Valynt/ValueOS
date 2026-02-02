/**
 * Toast Hook
 *
 * Toast notification system using sonner
 */

import { toast } from "sonner";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

export function useToast() {
  return {
    toast: (options: ToastOptions) => {
      const { title, description, variant = "default", duration = 3000 } = options;
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
