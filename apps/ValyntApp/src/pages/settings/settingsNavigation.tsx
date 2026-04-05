import type { ReactNode } from "react";

import { AppearancePage } from "./AppearancePage";
import { BrandingPage } from "./BrandingPage";
import { CompanyContextPage } from "./CompanyContextPage";
import { IntegrationsPage } from "./IntegrationsPage";
import { NotificationsPage } from "./NotificationsPage";
import { ProfilePage } from "./ProfilePage";
import { SecurityPage } from "./SecurityPage";

export interface SettingsNavItem {
  path: string;
  label: string;
  element: ReactNode;
}

export const settingsNavItems: SettingsNavItem[] = [
  { path: "profile", label: "My profile", element: <ProfilePage /> },
  { path: "security", label: "Security", element: <SecurityPage /> },
  { path: "appearance", label: "Appearance", element: <AppearancePage /> },
  { path: "notifications", label: "Notifications", element: <NotificationsPage /> },
  { path: "branding", label: "Branding", element: <BrandingPage /> },
  { path: "integrations", label: "Integrations", element: <IntegrationsPage /> },
  { path: "company-context", label: "Company Context", element: <CompanyContextPage /> },
];
