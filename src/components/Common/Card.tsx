import React from "react";
import { cn } from "@/utils/utils";

// Card Root
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outline" | "interactive";
  noPadding?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", noPadding = false, ...props }, ref) => {
    const variantClasses = {
      default: "bg-card border border-border",
      elevated: "bg-card shadow-md border-transparent",
      outline: "bg-transparent border border-border",
      interactive:
        "bg-card border border-border hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg text-card-foreground",
          variantClasses[variant],
          !noPadding && "p-6",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

// Card Header
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subtitle, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 mb-4", className)}
      {...props}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

// Card Content (Body)
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// Card Footer
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center pt-4 mt-auto border-t border-border",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardContent, CardFooter };
