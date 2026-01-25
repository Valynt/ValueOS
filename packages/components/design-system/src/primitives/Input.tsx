import React from "react";

export function Input({
  id,
  label,
  helper,
  error,
  style,
  ...props
}: {
  id: string;
  label?: string;
  helper?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const descId = helper || error ? `${id}-desc` : undefined;
  return (
    <div style={{ marginBottom: "var(--vds-space-3)" }}>
      {label && (
        <label
          htmlFor={id}
          style={{ display: "block", marginBottom: 4, color: "var(--vds-color-text-muted)" }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        aria-describedby={descId}
        {...props}
        style={{
          padding: "var(--vds-space-2)",
          border: "1px solid var(--vds-color-border)",
          borderRadius: 6,
          width: "100%",
          ...style,
        }}
      />
      {helper && (
        <div id={`${id}-desc`} style={{ color: "var(--vds-color-text-muted)", marginTop: "4px" }}>
          {helper}
        </div>
      )}
      {error && (
        <div
          id={`${id}-desc`}
          role="alert"
          style={{ color: "var(--vds-color-danger)", marginTop: "4px" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
