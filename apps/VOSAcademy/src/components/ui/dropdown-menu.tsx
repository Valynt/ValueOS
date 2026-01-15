import * as React from 'react';

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DropdownMenuTrigger({ children, asChild, ...props }: DropdownMenuTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
}

export const DropdownMenuContent = ({ children, align, ...props }: DropdownMenuContentProps) => (
  <div data-align={align} {...props}>{children}</div>
);

export const DropdownMenuItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="menuitem" tabIndex={0} {...props}>
    {children}
  </div>
);
