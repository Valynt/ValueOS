import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const variantStyles = {
  primary: "bg-[var(--vds-color-primary)] text-white hover:brightness-110 active:brightness-95 focus:ring-[var(--vds-color-primary)]/50",
  secondary: "bg-transparent border border-[var(--vds-color-border)] text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface)] active:bg-[var(--vds-color-surface)]/80 focus:ring-[var(--vds-color-border)]",
  ghost: "bg-transparent text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface)] active:bg-[var(--vds-color-surface)]/80 focus:ring-[var(--vds-color-border)]",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500/50",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm gap-1.5 rounded",
  md: "px-4 py-2 text-sm gap-2 rounded-md",
  lg: "px-6 py-3 text-base gap-2 rounded-lg",
} as const;

const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, leftIcon, rightIcon, children, disabled, className = "", ...rest }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        {...rest}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";
