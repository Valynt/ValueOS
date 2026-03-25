// apps/ValyntApp/src/components/DetailHeader.tsx
import { ChevronLeft, Edit } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const containerClasses = "flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 pb-6 border-b border-[var(--vds-color-border)]";
const titleClasses = "text-2xl font-bold text-[var(--vds-color-text-primary)]";
const subtitleClasses = "text-sm text-[var(--vds-color-text-muted)] mt-1";
const actionsClasses = "flex items-center gap-2";
const buttonBaseClasses = "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30";
const editButtonClasses = "bg-[var(--vds-color-primary)] text-white hover:brightness-110";
const backButtonClasses = "text-[var(--vds-color-text-muted)] hover:text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface)]";

const DetailHeader: React.FC<DetailHeaderProps> = ({
  title,
  subtitle,
  onEdit,
  onBack,
  actions,
  className
}) => {
  return (
    <div className={cn(containerClasses, className)}>
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={cn(buttonBaseClasses, backButtonClasses)}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
        <div>
          <h1 className={titleClasses}>{title}</h1>
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
        </div>
      </div>
      <div className={actionsClasses}>
        {onEdit && (
          <button
            onClick={onEdit}
            className={cn(buttonBaseClasses, editButtonClasses)}
            aria-label="Edit"
          >
            <Edit className="w-4 h-4" aria-hidden="true" />
            Edit
          </button>
        )}
        {actions}
      </div>
    </div>
  );
};

DetailHeader.displayName = "DetailHeader";

export default DetailHeader;
