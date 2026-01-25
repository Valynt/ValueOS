import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", children, style, ...rest }, ref) => (
    <button
      ref={ref}
      {...rest}
      data-variant={variant}
      style={{
        background: variant === "primary" ? "var(--vds-color-primary)" : "transparent",
        color: "var(--vds-color-text-primary)",
        padding: "var(--vds-space-2) var(--vds-space-4)",
        borderRadius: 6,
        border: variant === "secondary" ? "1px solid var(--vds-color-border)" : "none",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";
