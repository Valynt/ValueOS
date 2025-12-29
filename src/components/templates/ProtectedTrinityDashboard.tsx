/**
 * Example Integration: Protected Trinity Dashboard
 * Shows how to use ProtectedComponent in real templates
 */

import React from "react";
import {
  TrinityDashboard as BaseTrinityDashboard,
  type TrinityDashboardProps,
} from "./TrinityDashboard";
import { ProtectedComponent } from "../security/ProtectedComponent";

/**
 * Protected Trinity Dashboard
 * Wraps the financial dashboard with Zero Trust security
 */
export const ProtectedTrinityDashboard: React.FC<TrinityDashboardProps> = (
  props
) => {
  return (
    <ProtectedComponent
      requiredPermissions={["VIEW_FINANCIALS"]}
      resourceName="Trinity Dashboard (Financial Metrics)"
    >
      <BaseTrinityDashboard {...props} />
    </ProtectedComponent>
  );
};

export default ProtectedTrinityDashboard;
