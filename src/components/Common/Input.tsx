import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className = "", ...props }) => {
  return (
    <input
      {...props}
      className={[
        "sdui-input",
        "bg-card",
        "border",
        "border-border",
        "text-foreground",
        "rounded-lg",
        "px-vc-3",
        "py-vc-2",
        "focus:outline-none",
        "focus:border-primary",
        className,
      ].join(" ")}
    />
  );
};

export default Input;
