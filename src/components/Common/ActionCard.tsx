import React from "react";
import { Card } from "@/components/Common/Card";
import { cn } from "@/utils/utils";

export interface ActionCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  title,
  subtitle,
  onClick,
  className,
}) => {
  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className={cn(
        "flex flex-col h-full min-h-[160px] relative group",
        "transition-all duration-300 hover:-translate-y-1",
        className
      )}
    >
      <div className="mb-4 text-text-muted group-hover:text-primary transition-colors">
        {/* Scale the icon slightly on hover */}
        <div className="transform group-hover:scale-110 transition-transform origin-top-left">
          {icon}
        </div>
      </div>

      <h3 className="tex-base font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>

      <p className="text-sm text-text-muted leading-relaxed">{subtitle}</p>

      {/* Subtle background glow effect on hover */}
      <div
        className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none"
        aria-hidden="true"
      />
    </Card>
  );
};
