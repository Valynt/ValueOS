/**
 * Enhanced Button Component
 * Provides consistent button styling with proper states, loading, and accessibility
 */

import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses = {
  primary: `
    bg-primary text-primary-foreground
    hover:bg-primary/90
    active:bg-primary
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  secondary: `
    bg-secondary text-secondary-foreground border border-border
    hover:bg-secondary/90
    active:bg-secondary
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  outline: `
    bg-transparent border border-border text-foreground
    hover:bg-muted hover:text-muted-foreground
    active:bg-muted/80
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  ghost: `
    bg-transparent text-muted-foreground
    hover:bg-muted/90
    active:bg-muted/80
    disabled:opacity-40 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  danger: `
    bg-destructive text-destructive-foreground
    hover:bg-destructive/90
    active:bg-destructive
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-all duration-200
  `,
};

const sizeClasses = {
  xs: "px-vc-1 py-vc-1 text-xs rounded-md",
  sm: "px-vc-2 py-vc-1 text-sm rounded-md",
  md: "px-vc-3 py-vc-2 text-sm rounded-lg",
  lg: "px-vc-4 py-vc-2 text-base rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-ring
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              className={`
                ${size === "xs" ? "w-3 h-3" : ""}
                ${size === "sm" ? "w-4 h-4" : ""}
                ${size === "md" ? "w-4 h-4" : ""}
                ${size === "lg" ? "w-5 h-5" : ""}
                animate-spin
              `}
              aria-hidden="true"
            />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

/**
 * Icon Button
 * Square button with just an icon
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  label: string; // Required for accessibility
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = "ghost",
      size = "md",
      loading = false,
      label,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: "p-1 text-xs",
      sm: "p-1.5 text-sm",
      md: "p-2 text-base",
      lg: "p-3 text-lg",
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          rounded-lg
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-ring
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2
            className={`
              ${size === "xs" ? "w-3 h-3" : ""}
              ${size === "sm" ? "w-4 h-4" : ""}
              ${size === "md" ? "w-5 h-5" : ""}
              ${size === "lg" ? "w-6 h-6" : ""}
              animate-spin
            `}
            aria-hidden="true"
          />
        ) : (
          <span aria-hidden="true">{icon}</span>
        )}
        <span className="sr-only">{label}</span>
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

/**
 * Button Group
 * Group related buttons together
 */
interface ButtonGroupProps {
  children: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  orientation = "horizontal",
  className = "",
}) => {
  return (
    <div
      className={`
        inline-flex
        ${orientation === "horizontal" ? "flex-row" : "flex-col"}
        ${className}
      `}
      role="group"
    >
      {children}
    </div>
  );
};
