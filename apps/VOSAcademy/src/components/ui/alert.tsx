import * as React from 'react';

export type AlertProps = React.HTMLAttributes<HTMLDivElement>;

export const Alert = ({ children, role = 'alert', ...props }: AlertProps) => (
  <div role={role} {...props}>
    {children}
  </div>
);

export const AlertDescription = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p {...props}>{children}</p>
);

export const AlertTitle = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h4 {...props}>{children}</h4>
);
