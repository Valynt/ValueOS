import React from "react";

export interface SDUIAppProps {
  workspaceId?: string;
  children?: React.ReactNode;
}

export const SDUIApp: React.FC<SDUIAppProps> = ({ children }) => {
  return <>{children}</>;
};
