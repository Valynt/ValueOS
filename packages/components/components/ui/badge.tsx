import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  default: "bg-[var(--vds-color-primary)] text-white border-transparent",
  secondary: "bg-[var(--vds-color-surface)] text-[var(--vds-color-text-primary)] border-[var(--vds-color-border)]",
  outline: "bg-transparent text-[var(--vds-color-text-primary)] border-[var(--vds-color-border)]",
  destructive: "bg-red-100 text-red-700 border-red-200",
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
} as const;

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
} as const;

const baseClasses = "inline-flex items-center justify-center font-medium border rounded-full transition-colors duration-150";

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(baseClasses, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
