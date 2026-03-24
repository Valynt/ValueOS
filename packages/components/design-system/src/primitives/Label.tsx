import React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

const baseClasses = "inline-block font-medium text-[var(--vds-color-text-secondary)]";
const disabledClasses = "opacity-50 cursor-not-allowed";

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, htmlFor, required, optional, size = "md", disabled, className = "", ...rest }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={`${baseClasses} ${sizeClasses[size]} ${disabled ? disabledClasses : "cursor-pointer"} ${className}`}
      {...rest}
    >
      {children}
      {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      {optional && !required && (
        <span className="ml-1.5 text-xs text-[var(--vds-color-text-muted)] font-normal">(optional)</span>
      )}
    </label>
  )
);

Label.displayName = "Label";
export default Label;
