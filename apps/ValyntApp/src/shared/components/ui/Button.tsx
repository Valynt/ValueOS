/**
 * Button Component
 *
 * Reusable button component with consistent styling and behavior.
 * Part of the shared UI component library.
 */

import React, { forwardRef } from "react";

import { cn } from "../../../lib/utils/cn";

// ============================================================================
// Types
// ============================================================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

// ============================================================================
// Component
// ============================================================================

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      icon,
      iconPosition = "left",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };

    const classes = cn(baseStyles, variants[variant], sizes[size], className);

    const renderIcon = () => {
      if (!icon) return null;

      return (
        <span
          className={cn("flex items-center", {
            "mr-2": iconPosition === "left" && children,
            "ml-2": iconPosition === "right" && children,
          })}
        >
          {icon}
        </span>
      );
    };

    const renderContent = () => {
      if (loading) {
        return (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            {children && <span className="ml-2">{children}</span>}
          </>
        );
      }

      return (
        <>
          {iconPosition === "left" && renderIcon()}
          {children}
          {iconPosition === "right" && renderIcon()}
        </>
      );
    };

    return (
      <button className={classes} ref={ref} disabled={disabled || loading} {...props}>
        {renderContent()}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
