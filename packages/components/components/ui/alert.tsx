import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
}

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> { }

const variantConfig = {
  info: {
    icon: Info,
    classes: "bg-blue-50 text-blue-900 border-blue-200",
    iconClass: "text-blue-500",
  },
  success: {
    icon: CheckCircle,
    classes: "bg-green-50 text-green-900 border-green-200",
    iconClass: "text-green-500",
  },
  warning: {
    icon: AlertTriangle,
    classes: "bg-amber-50 text-amber-900 border-amber-200",
    iconClass: "text-amber-500",
  },
  error: {
    icon: AlertCircle,
    classes: "bg-red-50 text-red-900 border-red-200",
    iconClass: "text-red-500",
  },
} as const;

const baseClasses = "relative w-full border rounded-lg p-4 flex gap-3 items-start";

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(baseClasses, config.classes, className)}
        {...props}
      >
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconClass)} aria-hidden="true" />
        <div className="flex-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";
