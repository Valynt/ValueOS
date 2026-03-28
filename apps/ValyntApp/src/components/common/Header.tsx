import React from "react";
export interface HeaderProps { title?: string; className?: string; children?: React.ReactNode; }
export function Header({ title, className, children }: HeaderProps) {
  return <header className={className}><h1>{title}</h1>{children}</header>;
}
