/**
 * Card Component
 * Reusable card wrapper with consistent styling
 */

import React from "react";

export interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "bordered" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  variant = "default",
  padding = "md",
  className = "",
  onClick,
}) => {
  const variantClasses = {
    default: "bg-card border border-border",
    bordered: "bg-card border-2 border-primary/20",
    elevated: "bg-card shadow-lg border border-border/50",
  };

  const paddingClasses = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={`
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        rounded-lg transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}
        ${className}
      `}
      onClick={onClick}
    >
      {header && (
        <div className="mb-4 pb-3 border-b border-border">{header}</div>
      )}

      <div className="card-content">{children}</div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-border">{footer}</div>
      )}
    </div>
  );
};

export default Card;
