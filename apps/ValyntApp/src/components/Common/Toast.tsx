import React from "react";
export interface ToastProps { message?: string; type?: "success" | "error" | "info"; className?: string; }
export function Toast({ message, type = "info", className }: ToastProps) {
  return <div className={className} data-type={type}>{message}</div>;
}
export default Toast;
