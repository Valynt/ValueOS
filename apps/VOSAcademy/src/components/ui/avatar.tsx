import * as React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Avatar = ({ children, ...props }: AvatarProps) => <div {...props}>{children}</div>;

export const AvatarImage = ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />;

export const AvatarFallback = ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span {...props}>{children}</span>
);
