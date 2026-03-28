/**
 * Card Component
 *
 * Container component with variants for different use cases.
 * Follows ValueOS design system.
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground",
  {
    variants: {
      variant: {
        default: "border-border shadow-sm",
        elevated: "border-border shadow-md",
        outline: "border-border",
        ghost: "border-transparent bg-transparent",
        interactive: "border-border shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> { }

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

/**
 * MetricCard - Card for displaying a single metric value
 */
export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  className?: string;
}

const MetricCard = ({ label, value, icon, trend, className }: MetricCardProps) => {
  const trendColor = trend?.direction === "up"
    ? "text-success"
    : trend?.direction === "down"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {trend && (
            <p className={cn("mt-1 text-xs font-medium", trendColor)}>
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground">{icon}</div>
        )}
      </div>
    </Card>
  );
};

/**
 * ActionCard - Card with icon and action for quick actions
 */
export interface ActionCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const ActionCard = ({ title, description, icon, onClick, className }: ActionCardProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      variant="interactive"
      padding="md"
      className={cn("group", className)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? title : undefined}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <div>
          <h4 className="font-medium">{title}</h4>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export {
  Card,
  cardVariants,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  MetricCard,
  ActionCard,
};
