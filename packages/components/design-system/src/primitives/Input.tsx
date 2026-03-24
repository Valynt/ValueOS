import React from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ id, label, helper, error, required, className = "", ...props }, ref) => {
    const descId = helper || error ? `${id}-desc` : undefined;
    const hasError = Boolean(error);

    const baseClasses = "w-full px-3 py-2 bg-[var(--vds-color-surface)] border rounded-md text-[var(--vds-color-text-primary)] placeholder:text-[var(--vds-color-text-muted)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--vds-color-primary)]/30 focus:border-[var(--vds-color-primary)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--vds-color-surface)]/50";
    const stateClasses = hasError
      ? "border-red-400 focus:ring-red-500/30 focus:border-red-500"
      : "border-[var(--vds-color-border)] hover:border-[var(--vds-color-border-hover)]";

    return (
      <div className="mb-4">
        {label && (
          <label htmlFor={id} className="block mb-1.5 text-sm font-medium text-[var(--vds-color-text-secondary)]">
            {label}
            {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-describedby={descId}
          aria-invalid={hasError}
          aria-required={required}
          className={`${baseClasses} ${stateClasses} ${className}`}
          {...props}
        />
        {helper && !error && (
          <p id={`${id}-desc`} className="mt-1.5 text-xs text-[var(--vds-color-text-muted)]">{helper}</p>
        )}
        {error && (
          <p id={`${id}-desc`} role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
