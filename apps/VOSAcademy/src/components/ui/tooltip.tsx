import * as React from 'react';

export const TooltipProvider = ({ children }: { children: React.ReactNode; delayDuration?: number }) => <>{children}</>;
export const Tooltip = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

export function TooltipTrigger({ children, asChild, ...props }: TooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return <span {...props}>{children}</span>;
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export const TooltipContent = ({ children, side, align, ...props }: TooltipContentProps) => <div data-side={side} data-align={align} {...props}>{children}</div>;
