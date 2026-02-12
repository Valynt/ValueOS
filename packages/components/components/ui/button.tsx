import * as React from "react";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; };
export function Button({ variant: _v, size: _s, ...props }: ButtonProps) { return <button {...props} />; }
