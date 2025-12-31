import React from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      containerClassName = "",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Generate a unique ID if not provided, for accessibility
    const uniqueId = id || React.useId();
    const errorId = `${uniqueId}-error`;
    const helperId = `${uniqueId}-helper`;

    return (
      <div className={`flex flex-col gap-2 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={uniqueId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-text-muted pointer-events-none">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={uniqueId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={[
              "flex h-10 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground ring-offset-background",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-colors duration-200",
              error
                ? "border-error focus-visible:ring-error"
                : "border-input file:border-0 file:bg-transparent file:text-sm file:font-medium",
              leftIcon ? "pl-10" : "",
              rightIcon ? "pr-10" : "",
              className,
            ].join(" ")}
            {...props}
          />

          {rightIcon && !error && (
            <div className="absolute right-3 text-text-muted pointer-events-none">
              {rightIcon}
            </div>
          )}

          {error && (
            <div className="absolute right-3 text-error pointer-events-none animate-in fade-in zoom-in-95">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="text-xs text-error font-medium animate-in slide-in-from-top-1"
          >
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
