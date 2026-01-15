import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

export const Progress = ({ value = 0, max = 100, ...props }: ProgressProps) => (
  <div {...props} aria-valuenow={value} aria-valuemax={max} role="progressbar">
    <div style={{ width: `${Math.min(Math.max(value, 0), max)}%` }} />
  </div>
);
