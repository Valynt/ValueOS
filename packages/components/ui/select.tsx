import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Select({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function SelectGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder}</span>;
}

export function SelectTrigger({ children, ...props }: ButtonProps) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function SelectContent({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}

export function SelectItem({ children, ...props }: DivProps & { value?: string }) {
  return <div {...props}>{children}</div>;
}
