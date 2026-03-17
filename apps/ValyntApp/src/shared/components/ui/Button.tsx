import React from "react";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: string; size?: string; }
export const Button: React.FC<ButtonProps> = ({ children, ...props }) => <button {...props}>{children}</button>;
