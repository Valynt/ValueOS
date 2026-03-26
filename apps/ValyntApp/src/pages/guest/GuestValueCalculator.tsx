import * as React from "react";
export interface GuestValueCalculatorProps {
  tenantId?: string;
  companyName?: string;
  title?: string;
  guestName?: string;
  expiresAt?: string;
  canEdit?: boolean;
}
export function GuestValueCalculator(_props: GuestValueCalculatorProps): React.ReactElement {
  return React.createElement("div", null, "Guest Value Calculator");
}
