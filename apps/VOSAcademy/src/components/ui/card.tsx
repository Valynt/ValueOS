import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ children, ...props }: CardProps) => <div {...props}>{children}</div>;
export const CardHeader = ({ children, ...props }: CardProps) => <div {...props}>{children}</div>;
export const CardTitle = ({ children, ...props }: CardProps) => <h3 {...props}>{children}</h3>;
export const CardDescription = ({ children, ...props }: CardProps) => <p {...props}>{children}</p>;
export const CardContent = ({ children, ...props }: CardProps) => <div {...props}>{children}</div>;
export const CardFooter = ({ children, ...props }: CardProps) => <div {...props}>{children}</div>;
