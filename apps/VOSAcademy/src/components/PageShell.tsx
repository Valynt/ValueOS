import { SidebarLayout } from "@/components/SidebarLayout";
import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  containerClassName?: string;
  maxWidthClassName?: string;
  container?: boolean;
}

export function PageShell({
  children,
  className,
  mainClassName,
  containerClassName,
  maxWidthClassName = "max-w-6xl",
  container = true
}: PageShellProps) {
  const content = container ? (
    <div className={`container ${maxWidthClassName} ${containerClassName ?? ""}`}>
      {children}
    </div>
  ) : (
    <div className={containerClassName}>{children}</div>
  );

  return (
    <SidebarLayout>
      <div className={`min-h-screen bg-background flex flex-col ${className ?? ""}`}>
        <div className={`flex-1 py-8 ${mainClassName ?? ""}`}>{content}</div>
      </div>
    </SidebarLayout>
  );
}
