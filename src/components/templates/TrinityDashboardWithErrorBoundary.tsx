/**
 * Trinity Dashboard with Error Boundary
 * Wrapper component that adds error handling to Trinity Dashboard
 */

import React from "react";
import {
  TrinityDashboard,
  type TrinityDashboardProps,
} from "./TrinityDashboard";
import { TemplateErrorBoundary } from "../error-boundaries/TemplateErrorBoundary";

export const TrinityDashboardWithErrorBoundary: React.FC<
  TrinityDashboardProps
> = (props) => {
  return (
    <TemplateErrorBoundary
      templateName="Trinity Dashboard"
      onError={(error, errorInfo) => {
        // Log to monitoring service (e.g., Sentry)
        console.error("Trinity Dashboard Error:", error, errorInfo);
      }}
    >
      <TrinityDashboard {...props} />
    </TemplateErrorBoundary>
  );
};

export default TrinityDashboardWithErrorBoundary;
