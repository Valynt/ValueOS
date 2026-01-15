import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  title?: string | ReactNode;
  description?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export function SectionCard({
  children,
  className,
  title,
  description,
  header,
  footer
}: SectionCardProps) {
  return (
    <Card className={`bg-card text-card-foreground shadow-beautiful-md rounded-lg ${className ?? ""}`}>
      {(title || description || header) && (
        <CardHeader>
          {header || (
            <>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </>
          )}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
      {footer && <CardHeader>{footer}</CardHeader>}
    </Card>
  );
}
