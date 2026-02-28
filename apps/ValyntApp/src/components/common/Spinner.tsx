import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "white" | "muted";
  label?: string;
  className?: string;
}

const sizeClasses = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const variantClasses = {
  primary: "text-primary",
  white: "text-white",
  muted: "text-muted-foreground",
};

export function Spinner({
  size = "md",
  variant = "primary",
  label,
  className,
}: SpinnerProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
    >
      <Loader2
        className={cn(
          sizeClasses[size],
          variantClasses[variant],
          "animate-spin",
        )}
        aria-hidden="true"
      />
      {label && (
        <span className={cn("text-sm", variantClasses[variant])}>{label}</span>
      )}
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}

export function ButtonSpinner({
  variant = "white",
}: {
  variant?: "white" | "primary";
}) {
  return (
    <Loader2
      className={cn(
        "w-4 h-4 animate-spin",
        variant === "white" ? "text-white" : "text-primary",
      )}
      aria-hidden="true"
    />
  );
}

export default Spinner;
