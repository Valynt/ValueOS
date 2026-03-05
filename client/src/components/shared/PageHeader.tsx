/*
 * PageHeader — Consistent page title + description + action area.
 * Standardizes the top section of every page.
 *
 * Usage:
 *   <PageHeader title="Value Cases" description="5 active cases" action={<Button>New Case</Button>} />
 */
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action slot (buttons, filters, etc.) */
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
