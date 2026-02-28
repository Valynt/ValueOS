/**
 * PageHeader
 *
 * Consistent page-level header answering the 5-Second Rule:
 * "Where am I?" (title), "What is the system doing?" (status),
 * "What do I need to do next?" (primary action).
 *
 * UX Principles:
 * - POLA: same header layout on every page
 * - Visual Hierarchy: title in F-pattern top-left, action top-right
 * - 5-Second Rule: title + description + action immediately orient the user
 */

import React from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Page title — answers "Where am I?" */
  title: string;
  /** Brief description — answers "What is this?" */
  description?: string;
  /** Status badge (e.g., "3 active", "Draft") */
  badge?: React.ReactNode;
  /** Primary action — answers "What do I do next?" */
  action?: React.ReactNode;
  /** Secondary actions */
  secondaryActions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  action,
  secondaryActions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryActions) && (
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions}
          {action}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
