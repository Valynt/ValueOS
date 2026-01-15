import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: string;
}

export const Badge = ({ children, ...props }: BadgeProps) => (
  <span {...props}>{children}</span>
);
