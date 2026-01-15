import * as React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = ({ children, ...props }: SkeletonProps) => <div {...props}>{children}</div>;
