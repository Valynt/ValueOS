/*
 * EmptyState — Consistent empty/no-results state with icon, title, description, and CTA.
 *
 * Usage:
 *   <EmptyState icon={Search} title="No results" description="Try a different search." />
 *   <EmptyState icon={Sparkles} title="No cases yet" action={<Button>Create</Button>} dashed />
 */
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Use dashed border for "create first" states */
  dashed?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dashed = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card text-center",
        dashed ? "border-2 border-dashed border-border p-16" : "border border-border p-12",
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 text-foreground/30" />
      </div>
      <h3 className={cn("font-semibold text-foreground", dashed ? "text-lg" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
