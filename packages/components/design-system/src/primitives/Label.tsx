import React from "react";

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({
  children,
  htmlFor,
  style,
  ...rest
}) => (
  <label
    htmlFor={htmlFor}
    style={{
      display: "inline-block",
      marginBottom: 4,
      color: "var(--vds-color-text-muted)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </label>
);

export default Label;
