/*
 * SectionCard — Card wrapper with a consistent header (title + optional link/action).
 * Used for dashboard sections like "Recent Cases", "Agent Activity", chart panels.
 *
 * Usage:
 *   <SectionCard title="Recent Cases" linkText="View All Cases →" linkHref="/cases">
 *     <table>...</table>
 *   </SectionCard>
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  /** "View All →" link */
  linkText?: string;
  linkHref?: string;
  /** Alternative: custom action element */
  action?: React.ReactNode;
  /** Remove padding from CardContent (useful for tables) */
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  linkText,
  linkHref,
  action,
  noPadding = false,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {linkText && linkHref ? (
            <Link
              href={linkHref}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              {linkText}
            </Link>
          ) : action ? (
            action
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn(noPadding && "p-0")}>
        {children}
      </CardContent>
    </Card>
  );
}
