import React from "react";

export interface BootstrapGuardProps {
  children: React.ReactNode;
}

export const BootstrapGuard: React.FC<BootstrapGuardProps> = ({ children }) => {
  return <>{children}</>;
};
