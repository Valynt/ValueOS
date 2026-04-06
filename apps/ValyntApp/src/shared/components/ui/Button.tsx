import React from "react";
export interface LegacyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: string; size?: string; }
export const LegacyButton: React.FC<LegacyButtonProps> = ({ children, ...props }) => <button {...props}>{children}</button>;
